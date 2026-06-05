import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

async function loadOwned(cardId: string, ownerId: string) {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("cards")
    .select("id, owner_id, spots")
    .eq("id", cardId)
    .maybeSingle();
  if (!data) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (data.owner_id !== ownerId)
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { admin, card: data };
}

// Owner sets the role label on a member.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const { userId: actorId } = await auth();
  if (!actorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const guard = await loadOwned(params.id, actorId);
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => ({}))) as { role?: string; state?: string };
  const patch: { role?: string; state?: "joined" | "requested" } = {};
  if (typeof body.role === "string") {
    patch.role = body.role.trim().slice(0, 40);
  }
  if (body.state === "joined" || body.state === "requested") {
    patch.state = body.state;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  // If we're promoting from requested → joined, make sure the slot cap isn't broken.
  if (patch.state === "joined" && guard.card.spots != null) {
    const { count } = await guard.admin
      .from("members")
      .select("user_id", { head: true, count: "exact" })
      .eq("card_id", params.id)
      .eq("state", "joined");
    if ((count ?? 0) >= guard.card.spots) {
      return NextResponse.json({ error: "full" }, { status: 400 });
    }
  }

  const { error } = await guard.admin
    .from("members")
    .update(patch)
    .eq("card_id", params.id)
    .eq("user_id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Owner removes a member (joined or requested).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const { userId: actorId } = await auth();
  if (!actorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const guard = await loadOwned(params.id, actorId);
  if (guard.error) return guard.error;

  const { error } = await guard.admin
    .from("members")
    .delete()
    .eq("card_id", params.id)
    .eq("user_id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
