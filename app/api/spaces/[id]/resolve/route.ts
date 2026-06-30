import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { resolveExternalRefs, isResolvableTopic } from "@/lib/server/wikipedia";
import { authorizeSpaceViewer } from "@/lib/server/spaceRead";
import { apiServerError } from "@/lib/api/serverError";

/**
 * POST /api/spaces/[id]/resolve
 *
 * Lazy external-reference hydration. Space creation stores Wikipedia
 * widgets with topic-only data (to stay under the serverless timeout);
 * SpaceView calls this once on first load when it sees an unresolved
 * Wikipedia widget. We resolve url/extract/thumbnail and persist the
 * enriched modules in place (no version snapshot — this is enrichment,
 * not a content edit). Idempotent: re-running is a no-op once resolved.
 *
 * Resolution only uses a topic already stored in the project, but it still
 * persists module data. Therefore it follows the same visibility gate as a
 * project snapshot instead of allowing arbitrary project ids to be mutated.
 */
export const maxDuration = 15;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = supabaseAdmin();
  const { userId } = await auth();
  const role = await authorizeSpaceViewer(admin, { spaceId: id, userId });
  if (!role) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: space, error } = await admin
    .from("spaces")
    .select("id, modules, language, modules_rev")
    .eq("id", id)
    .maybeSingle();
  if (error) return apiServerError("resolve_failed", "space-resolve/read", error);
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const modules = Array.isArray(space.modules) ? (space.modules as unknown[]) : [];

  // Anything to do? Only Wikipedia widgets that have a real topic (or a
  // URL) but no resolved url yet. Placeholder "…" widgets are left alone.
  const needs = modules.some((m) => {
    if (!m || typeof m !== "object") return false;
    const w = m as { type?: string; url?: string; topic?: string };
    return w.type === "wikipedia" && !w.url && isResolvableTopic(w.topic);
  });
  if (!needs) return NextResponse.json({ ok: true, resolved: false });

  let resolved: unknown[];
  try {
    resolved = await resolveExternalRefs(modules, String(space.language ?? "en"));
  } catch {
    return NextResponse.json({ ok: true, resolved: false });
  }

  const { data: updated, error: upErr } = await admin
    .from("spaces")
    .update({ modules: resolved, modules_rev: Number(space.modules_rev ?? 0) + 1 })
    .eq("id", id)
    .eq("modules_rev", Number(space.modules_rev ?? 0))
    .select("id");
  if (upErr) return apiServerError("resolve_failed", "space-resolve/write", upErr);
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "modules_conflict" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, resolved: true });
}
