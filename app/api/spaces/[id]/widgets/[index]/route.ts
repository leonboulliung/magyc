import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { apiServerError } from "@/lib/api/serverError";
import { sanitizeModule } from "@/lib/modules";
import { newId } from "@/lib/id";
import { resolveWikipedia } from "@/lib/server/wikipedia";
import { parseBody } from "@/lib/api/validate";
import { isSpaceOwner, forbidden } from "@/lib/api/auth";

function isMissingModulesRev(error: unknown): boolean {
  const e = error as { message?: string; details?: string; hint?: string; code?: string } | null;
  return [e?.message, e?.details, e?.hint, e?.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes("modules_rev");
}

async function fetchWidgetSpace(admin: ReturnType<typeof supabaseAdmin>, spaceId: string) {
  const selectWithRev = "id, anon_owner_token, owner_id, visibility, modules, modules_rev, title, language";
  const selectLegacy = "id, anon_owner_token, owner_id, visibility, modules, title, language";
  const primary = await admin.from("spaces").select(selectWithRev).eq("id", spaceId).maybeSingle();
  if (!primary.error || !isMissingModulesRev(primary.error)) return primary;
  return admin.from("spaces").select(selectLegacy).eq("id", spaceId).maybeSingle();
}

/**
 * PUT /api/spaces/[id]/widgets/[index]
 *
 *   Body: { widget: Module, anonOwnerToken?: string, note?: string }
 *
 * Replace the widget at the given index with a new config. Authorisation:
 *   - Drafts (visibility === null): require the matching anon_owner_token.
 *   - Published spaces: require the Clerk-bound owner. Collaborative
 *     interaction still flows through /state; structural widget edits
 *     stay owner-only.
 *
 * The widget shape is sanitised before storage; a mismatch (different
 * type than what's currently at the index) is allowed — that's a
 * legitimate "swap this widget for another" operation. To insert or
 * delete widgets we'll add separate endpoints.
 */
export async function PUT(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string; index: string }> },
) {
  const params = await paramsPromise;
  const widgetIndex = Number.parseInt(params.index, 10);
  if (!Number.isFinite(widgetIndex) || widgetIndex < 0 || widgetIndex > 64) {
    return NextResponse.json({ error: "bad_widget_index" }, { status: 400 });
  }

  const parsed = await parseBody(req, z.object({
    widget: z.unknown().optional(),
    modulesRev: z.number().int().nonnegative().optional(),
    anonOwnerToken: z.string().nullish(),
    note: z.string().optional(),
    resolveExternal: z.boolean().optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  let widget = sanitizeModule(body.widget);
  if (!widget) {
    return NextResponse.json({ error: "widget_invalid" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : null;

  const admin = supabaseAdmin();
  const { data: space, error: fetchErr } = await fetchWidgetSpace(admin, params.id);
  if (fetchErr) return apiServerError("save_failed", "widget/read", fetchErr);
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Authorisation — owner-only (draft: anon token; published: Clerk owner).
  if (!await isSpaceOwner(space, body.anonOwnerToken)) return forbidden();

  const currentModules = Array.isArray(space.modules) ? (space.modules as unknown[]) : [];
  if (widgetIndex >= currentModules.length) {
    return NextResponse.json({ error: "widget_out_of_range" }, { status: 400 });
  }

  // External resolution: when the widget is Wikipedia, always re-hit
  // the MediaWiki API so url/extract/thumbnail stay in sync with the
  // topic. Also runs on suggestion picks; opt-in elsewhere via the
  // `resolveExternal` body flag.
  const shouldResolve =
    widget.type === "wikipedia" || body.resolveExternal === true;
  if (shouldResolve && widget.type === "wikipedia") {
    widget = await resolveWikipedia(widget, (space as { language?: string }).language || "en");
  }

  // Build the new modules array — replace the widget at index, keep
  // everything else intact.
  const nextModules: unknown[] = [...currentModules];
  nextModules[widgetIndex] = widget;

  // The heading at index 0 is the project title. Editing it must also update
  // the `title` column — otherwise the browser tab, OG metadata and the
  // dashboards keep the AI's original title (BACKLOG #9b).
  const nextTitle =
    widgetIndex === 0 && widget.type === "heading" && widget.text.trim()
      ? widget.text.trim().slice(0, 200)
      : (space.title as string | null) ?? "";
  const currentRev = typeof (space as { modules_rev?: unknown }).modules_rev === "number"
    ? (space as unknown as { modules_rev: number }).modules_rev
    : 0;
  const expectedRev = typeof body.modulesRev === "number" ? body.modulesRev : currentRev;
  const spaceUpdate: { modules: unknown[]; modules_rev?: number; title?: string } = {
    modules: nextModules,
    modules_rev: expectedRev + 1,
  };
  if (nextTitle !== ((space.title as string | null) ?? "")) spaceUpdate.title = nextTitle;

  // Persist. The .select() is load-bearing: without it Supabase reports
  // success even when 0 rows matched (silent no-op writes).
  let { data: updated, error: upErr } = await admin
    .from("spaces")
    .update(spaceUpdate)
    .eq("id", params.id)
    .eq("modules_rev", expectedRev)
    .select("id");
  if (upErr && isMissingModulesRev(upErr)) {
    const legacyUpdate = { ...spaceUpdate };
    delete legacyUpdate.modules_rev;
    const fallback = await admin
      .from("spaces")
      .update(legacyUpdate)
      .eq("id", params.id)
      .select("id");
    updated = fallback.data;
    upErr = fallback.error;
  }
  if (upErr) return apiServerError("save_failed", "widget/write", upErr);
  if (!updated || updated.length === 0) {
    // Optimistic-lock miss: the space advanced under us. Hand back the
    // current rev so a single-widget edit can retry against it instead of
    // silently failing (which looked to the user like "the element won't
    // fill" right after adding it, when the add had just bumped the rev).
    return NextResponse.json({ error: "modules_conflict", modulesRev: currentRev }, { status: 409 });
  }

  // If published: snapshot a version — but COALESCE rapid edits. A pin
  // drag or a flurry of inline edits should not each become a version.
  // If the newest version is younger than COALESCE_MS, update it in
  // place; only an edit after a quiet gap starts a fresh version.
  const COALESCE_MS = 90_000;
  let newVersion: number | null = null;
  if (space.visibility !== null) {
    const { data: latest } = await admin
      .from("space_versions")
      .select("id, version, created_at")
      .eq("space_id", params.id)
      .order("version", { ascending: false })
      .limit(1);
    const top = latest && latest[0];
    const topAgeMs = top?.created_at ? Date.now() - new Date(top.created_at).getTime() : Infinity;

    if (top && topAgeMs < COALESCE_MS) {
      // Fold this edit into the most recent version.
      const { data: versionUpdated, error: vErr } = await admin
        .from("space_versions")
        .update({ modules: nextModules, title: nextTitle, note })
        .eq("id", top.id)
        .select("id");
      if (vErr) return apiServerError("save_failed", "widget/version-update", vErr);
      if (!versionUpdated || versionUpdated.length === 0) {
        return NextResponse.json({ error: "version_update_no_match" }, { status: 500 });
      }
      newVersion = top.version;
    } else {
      const nextVersion = (top?.version ?? 0) + 1;
      const { error: vErr } = await admin.from("space_versions").insert({
        id: newId(),
        space_id: params.id,
        version: nextVersion,
        title: nextTitle,
        modules: nextModules,
        note,
      });
      if (vErr) return apiServerError("save_failed", "widget/version-insert", vErr);
      newVersion = nextVersion;
    }
  }

  return NextResponse.json({ ok: true, version: newVersion, widget, modulesRev: expectedRev + 1 });
}
