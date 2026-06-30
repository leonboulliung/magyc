import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/validate";
import { newId } from "@/lib/id";
import { projectMembershipsUnavailable } from "@/lib/server/projectAccess";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { takePersistentRateLimit } from "@/lib/server/uploadSecurity";

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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const gate = await ownerGate(id, userId);
  if (gate.response) return gate.response;
  const { data, error } = await gate.admin!
    .from("project_members")
    .select("id, user_id, email, display_name, role, created_at")
    .eq("space_id", id)
    .order("created_at", { ascending: true });
  if (projectMembershipsUnavailable(error)) return NextResponse.json({ members: [], invitations: [], migrationRequired: true });
  if (error) return NextResponse.json({ error: "members_failed" }, { status: 500 });
  const invitationsResult = await gate.admin!
    .from("project_invitations")
    .select("id, email, display_name, role, status, expires_at, created_at")
    .eq("space_id", id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });
  const invitationsUnavailable = invitationsResult.error?.code === "42P01"
    || invitationsResult.error?.code === "PGRST205"
    || (invitationsResult.error?.message || "").includes("project_invitations");
  if (invitationsResult.error && !invitationsUnavailable) {
    return NextResponse.json({ error: "members_failed" }, { status: 500 });
  }
  const activeMembers = (data ?? []).filter((member) => !!member.user_id);
  const legacyInvitations = (data ?? []).filter((member) => !member.user_id).map((member) => ({
    id: member.id,
    email: member.email,
    display_name: member.display_name,
    role: member.role,
    status: "pending",
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    created_at: member.created_at,
    legacy: true,
  }));
  return NextResponse.json({
    members: activeMembers,
    invitations: invitationsResult.data ?? legacyInvitations,
    invitationsMigrationRequired: invitationsUnavailable,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await parseBody(req, memberInput);
  if (!parsed.ok) return parsed.response;
  const gate = await ownerGate(id, userId);
  if (gate.response) return gate.response;
  const admin = gate.admin!;
  const email = parsed.data.email.toLowerCase();
  const allowed = await takePersistentRateLimit(admin, `project-invite:${userId}`, 60 * 60, 30);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { data: currentMember } = await admin
    .from("project_members")
    .select("id")
    .eq("space_id", id)
    .eq("email", email)
    .maybeSingle();
  if (currentMember) return NextResponse.json({ error: "member_already_active" }, { status: 409 });

  let displayName = parsed.data.displayName || "";
  try {
    const clerk = await clerkClient();
    const owner = await clerk.users.getUser(userId);
    const ownerEmails = owner.emailAddresses.map((item) => item.emailAddress.trim().toLowerCase());
    if (ownerEmails.includes(email)) {
      return NextResponse.json({ error: "member_is_owner" }, { status: 409 });
    }
  } catch {
    // The database still prevents the owner from accepting their own invite.
  }

  const { data: existingInvitation } = await admin
    .from("project_invitations")
    .select("id")
    .eq("space_id", id)
    .eq("email", email)
    .maybeSingle();
  const row = {
    id: existingInvitation?.id || newId(),
    space_id: id,
    email,
    display_name: displayName || null,
    role: parsed.data.role,
    invited_by: userId,
    status: "pending",
    accepted_by: null,
    responded_at: null,
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data: saved, error } = await admin
    .from("project_invitations")
    .upsert(row, { onConflict: "space_id,email" })
    .select("id, email, display_name, role, status, expires_at, created_at")
    .single();
  if (error?.code === "42P01" || error?.code === "PGRST205" || (error?.message || "").includes("project_invitations")) {
    return NextResponse.json({ error: "project_invitations_migration_required" }, { status: 503 });
  }
  if (error) {
    console.error("[project-members] invite failed:", error.message);
    return NextResponse.json({ error: "members_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, invitation: saved });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await parseBody(req, z.object({
    memberId: z.string().min(1).max(120),
    role: z.enum(["editor", "client"]),
    kind: z.enum(["member", "invitation"]).default("member"),
  }));
  if (!parsed.ok) return parsed.response;
  const gate = await ownerGate(id, userId);
  if (gate.response) return gate.response;
  const table = parsed.data.kind === "invitation" ? "project_invitations" : "project_members";
  const { data, error } = await gate.admin!
    .from(table)
    .update({ role: parsed.data.role, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.memberId)
    .eq("space_id", id)
    .select("id");
  if (projectMembershipsUnavailable(error)) {
    return NextResponse.json({ error: "project_members_migration_required" }, { status: 503 });
  }
  if (error || !data?.length) return NextResponse.json({ error: "members_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await parseBody(req, z.object({
    memberId: z.string().min(1).max(120),
    kind: z.enum(["member", "invitation"]).default("member"),
  }));
  if (!parsed.ok) return parsed.response;
  const gate = await ownerGate(id, userId);
  if (gate.response) return gate.response;
  const table = parsed.data.kind === "invitation" ? "project_invitations" : "project_members";
  const { error } = await gate.admin!
    .from(table)
    .delete()
    .eq("id", parsed.data.memberId)
    .eq("space_id", id);
  if (projectMembershipsUnavailable(error)) {
    return NextResponse.json({ error: "project_members_migration_required" }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: "members_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
