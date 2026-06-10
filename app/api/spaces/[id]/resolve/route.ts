import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveExternalRefs } from "@/lib/server/wikipedia";

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
 * No auth: this only fills public reference data on an existing space;
 * it cannot change user content or ownership.
 */
export const maxDuration = 15;

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = supabaseAdmin();
  const { data: space, error } = await admin
    .from("spaces")
    .select("id, modules, language")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const modules = Array.isArray(space.modules) ? (space.modules as unknown[]) : [];

  // Anything to do? Only Wikipedia widgets without a resolved url.
  const needs = modules.some(
    (m) =>
      m && typeof m === "object" &&
      (m as { type?: string }).type === "wikipedia" &&
      !(m as { url?: string }).url,
  );
  if (!needs) return NextResponse.json({ ok: true, resolved: false });

  let resolved: unknown[];
  try {
    resolved = await resolveExternalRefs(modules, String(space.language ?? "en"));
  } catch {
    return NextResponse.json({ ok: true, resolved: false });
  }

  const { error: upErr } = await admin
    .from("spaces")
    .update({ modules: resolved })
    .eq("id", params.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, resolved: true });
}
