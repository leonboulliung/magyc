import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizeModule } from "@/lib/modules";
import { newId } from "@/lib/id";
import { resolveWikipedia } from "@/lib/server/wikipedia";
import { parseBody } from "@/lib/api/validate";

/**
 * PUT /api/spaces/[id]/widgets/[index]
 *
 *   Body: { widget: Module, anonOwnerToken?: string, note?: string }
 *
 * Replace the widget at the given index with a new config. Authorisation:
 *   - Drafts (visibility === null): require the matching anon_owner_token.
 *   - Published spaces: require either the Clerk owner OR a Clerk-
 *     authenticated visitor (collaborative edit; published spaces are
 *     open for now). The published path also writes a new version
 *     snapshot.
 *
 * The widget shape is sanitised before storage; a mismatch (different
 * type than what's currently at the index) is allowed — that's a
 * legitimate "swap this widget for another" operation. To insert or
 * delete widgets we'll add separate endpoints.
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string; index: string } },
) {
  const widgetIndex = Number.parseInt(params.index, 10);
  if (!Number.isFinite(widgetIndex) || widgetIndex < 0 || widgetIndex > 64) {
    return NextResponse.json({ error: "bad_widget_index" }, { status: 400 });
  }

  const parsed = await parseBody(req, z.object({
    widget: z.unknown(),
    anonOwnerToken: z.string().optional(),
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
  const { data: space, error: fetchErr } = await admin
    .from("spaces")
    .select("id, anon_owner_token, owner_id, visibility, modules, title, language")
    .eq("id", params.id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Authorisation.
  const { userId } = await auth();
  if (space.visibility === null) {
    // Draft: anon owner token must match.
    const token = typeof body.anonOwnerToken === "string" ? body.anonOwnerToken.trim() : "";
    if (token.length < 16 || token !== space.anon_owner_token) {
      return NextResponse.json({ error: "owner_token_mismatch" }, { status: 403 });
    }
  } else {
    // Published: Clerk session required.
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

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

  // Persist.
  const { error: upErr } = await admin
    .from("spaces")
    .update({ modules: nextModules })
    .eq("id", params.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

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
      const { error: vErr } = await admin
        .from("space_versions")
        .update({ modules: nextModules, title: space.title || "", note })
        .eq("id", top.id);
      if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
      newVersion = top.version;
    } else {
      const nextVersion = (top?.version ?? 0) + 1;
      const { error: vErr } = await admin.from("space_versions").insert({
        id: newId(),
        space_id: params.id,
        version: nextVersion,
        title: space.title || "",
        modules: nextModules,
        note,
      });
      if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
      newVersion = nextVersion;
    }
  }

  return NextResponse.json({ ok: true, version: newVersion });
}
