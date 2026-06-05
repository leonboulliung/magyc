import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { newId } from "@/lib/id";

/**
 * POST /api/spaces/[id]/contributions — add a contribution to a
 * specific primitive on a space.
 *
 *   Body: {
 *     primitiveIndex: number,
 *     kind: "voice" | "claim" | "resource",
 *     data: { ... }   // depends on kind
 *   }
 *
 * Authenticated only. Visitors who want to react sign in once and
 * carry that identity through any contributions on any space.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    primitiveIndex?: unknown;
    kind?: unknown;
    data?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const primitiveIndex = typeof body.primitiveIndex === "number" ? Math.floor(body.primitiveIndex) : -1;
  if (primitiveIndex < 0 || primitiveIndex > 32) {
    return NextResponse.json({ error: "bad_primitive_index" }, { status: 400 });
  }
  const kind = body.kind;
  if (kind !== "voice" && kind !== "claim" && kind !== "resource") {
    return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  }

  // Validate + sanitize the kind-specific data.
  let data: Record<string, unknown> = {};
  const r = body.data || {};
  if (kind === "voice") {
    const text = typeof r.text === "string" ? r.text.trim().slice(0, 800) : "";
    if (!text) return NextResponse.json({ error: "voice_text_required" }, { status: 400 });
    data = { text };
  } else if (kind === "claim") {
    const ask = typeof r.ask === "string" ? r.ask.trim().slice(0, 80) : "";
    if (!ask) return NextResponse.json({ error: "claim_ask_required" }, { status: 400 });
    data = { ask };
  } else if (kind === "resource") {
    const url = typeof r.url === "string" ? r.url.trim().slice(0, 500) : "";
    if (!/^https?:\/\/[^\s]+$/i.test(url)) {
      return NextResponse.json({ error: "resource_url_invalid" }, { status: 400 });
    }
    const caption = typeof r.caption === "string" ? r.caption.trim().slice(0, 120) : undefined;
    data = caption ? { url, caption } : { url };
  }

  const admin = supabaseAdmin();
  // Verify the space + primitive index exists.
  const { data: space } = await admin
    .from("spaces")
    .select("id, primitives")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!Array.isArray(space.primitives) || primitiveIndex >= space.primitives.length) {
    return NextResponse.json({ error: "primitive_out_of_range" }, { status: 400 });
  }

  await ensureProfile(userId);

  const id = newId();
  const { error } = await admin.from("contributions").insert({
    id,
    space_id: params.id,
    primitive_index: primitiveIndex,
    user_id: userId,
    kind,
    data,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id });
}
