import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { newId, newAnonToken } from "@/lib/id";

/**
 * POST /api/projects/[id]/duplicate — copy a suite project as a fresh
 * draft. Owner-only. Copies the config (modules/title/style/labels) but
 * NOT the collaborative module_state (a duplicate is a clean start).
 * Resets stage to 'brief'.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: src } = await admin
    .from("spaces")
    .select("owner_id, input_text, title, language, vibe, modules, labels, style, segment")
    .eq("id", params.id)
    .maybeSingle();
  if (!src) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (src.owner_id !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const id = newId();
  const { error } = await admin.from("spaces").insert({
    id,
    input_text: src.input_text,
    title: src.title ? `Kopie von ${src.title}`.slice(0, 200) : "",
    language: src.language,
    vibe: src.vibe,
    modules: src.modules ?? [],
    labels: src.labels ?? {},
    style: src.style,
    anon_owner_token: newAnonToken(),
    owner_id: userId,
    visibility: null,
    stage: "brief",
    segment: src.segment,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id });
}
