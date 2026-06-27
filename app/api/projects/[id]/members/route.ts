import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/validate";
import { newId } from "@/lib/id";
import { projectMembershipsUnavailable } from "@/lib/server/projectAccess";
import { ensureProfile } from "@/lib/server/profile";
import { supabaseAdmin } from "@/lib/supabase";

const memberInput = z.object({
  email: z.string().trim().email().max(240),
  displayName: z.string().trim().max(120).optional(),
  role: z.enum(["editor", "client"]),
});

async function ownerGate(spaceId: string, userId: string) {
  const admin = supabaseAdmin();
  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id")
    .eq("id", spaceId)
    .maybeSingle();
  if (!space) return { response: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (space.owner_id !== userId) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { admin };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const gate = await ownerGate(params.id, userId);
  if (gate.response) return gate.response;
  const { data, error } = await gate.admin!
    .from("project_members")
    .select("id, user_id, email, display_name, role, created_at")
    .eq("space_id", params.id)
    .order("created_at", { ascending: true });
  if (projectMembershipsUnavailable(error)) return NextResponse.json({ members: [], migrationRequired: true });
  if (error) return NextResponse.json({ error: "members_failed" }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await parseBody(req, memberInput);
  if (!parsed.ok) return parsed.response;
  const gate = await ownerGate(params.id, userId);
  if (gate.response) return gate.response;
  const admin = gate.admin!;
  const email = parsed.data.email.toLowerCase();
  let invitedUserId: string | null = null;
  let displayName = parsed.data.displayName || "";
  try {
    const clerk = await clerkClient();
    const result = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
    const user = result.data[0];
    if (user) {
      invitedUserId = user.id;
      displayName = displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "";
      await ensureProfile(user.id);
    }
  } catch {
    // Pending email memberships are claimed when that address signs in.
  }
  if (invitedUserId === userId) {
    return NextResponse.json({ error: "member_is_owner" }, { status: 409 });
  }

  const row = {
    id: newId(),
    space_id: params.id,
    user_id: invitedUserId,
    email,
    display_name: displayName || null,
    role: parsed.data.role,
    invited_by: userId,
    updated_at: new Date().toISOString(),
  };
  let query;
  if (invitedUserId) {
    const existing = await admin
      .from("project_members")
      .select("id")
      .eq("space_id", params.id)
      .eq("user_id", invitedUserId)
      .maybeSingle();
    query = existing.data
      ? admin.from("project_members").update({ ...row, id: existing.data.id }).eq("id", existing.data.id)
      : admin.from("project_members").upsert(row, { onConflict: "space_id,email" });
  } else {
    query = admin.from("project_members").upsert(row, { onConflict: "space_id,email" });
  }
  const { data: saved, error } = await query
    .select("id, user_id, email, display_name, role, created_at")
    .single();
  if (projectMembershipsUnavailable(error)) {
    return NextResponse.json({ error: "project_members_migration_required" }, { status: 503 });
  }
  if (error) {
    console.error("[project-members] invite failed:", error.message);
    return NextResponse.json({ error: "members_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, member: saved });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await parseBody(req, z.object({
    memberId: z.string().min(1).max(120),
    role: z.enum(["editor", "client"]),
  }));
  if (!parsed.ok) return parsed.response;
  const gate = await ownerGate(params.id, userId);
  if (gate.response) return gate.response;
  const { data, error } = await gate.admin!
    .from("project_members")
    .update({ role: parsed.data.role, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.memberId)
    .eq("space_id", params.id)
    .select("id");
  if (projectMembershipsUnavailable(error)) {
    return NextResponse.json({ error: "project_members_migration_required" }, { status: 503 });
  }
  if (error || !data?.length) return NextResponse.json({ error: "members_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await parseBody(req, z.object({ memberId: z.string().min(1).max(120) }));
  if (!parsed.ok) return parsed.response;
  const gate = await ownerGate(params.id, userId);
  if (gate.response) return gate.response;
  const { error } = await gate.admin!
    .from("project_members")
    .delete()
    .eq("id", parsed.data.memberId)
    .eq("space_id", params.id);
  if (projectMembershipsUnavailable(error)) {
    return NextResponse.json({ error: "project_members_migration_required" }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: "members_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
