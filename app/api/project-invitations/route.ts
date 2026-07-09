import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/validate";
import { ensureProfile } from "@/lib/server/profile";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { de } from "@/lib/i18n/dictionaries/de";

function invitationsUnavailable(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === "42P01"
    || value?.code === "PGRST205"
    || (value?.message || "").includes("project_invitations");
}

async function verifiedEmails(userId: string): Promise<string[]> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  return user.emailAddresses
    .filter((entry) => entry.verification?.status === "verified")
    .map((entry) => entry.emailAddress.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let emails: string[];
  try {
    emails = await verifiedEmails(userId);
  } catch {
    return NextResponse.json({ error: "account_unavailable" }, { status: 503 });
  }
  if (!emails.length) return NextResponse.json({ invitations: [] });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("project_invitations")
    .select("id, space_id, email, display_name, role, invited_by, expires_at, created_at")
    .eq("status", "pending")
    .in("email", emails)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (invitationsUnavailable(error)) {
    return NextResponse.json({ invitations: [], migrationRequired: true });
  }
  if (error) return NextResponse.json({ error: "invitations_failed" }, { status: 500 });

  const rows = data ?? [];
  const spaceIds = [...new Set(rows.map((row) => String(row.space_id)))];
  const inviterIds = [...new Set(rows.map((row) => String(row.invited_by)))];
  const [{ data: spaces }, { data: inviters }] = await Promise.all([
    spaceIds.length
      ? admin.from("spaces").select("id, title, stage").in("id", spaceIds)
      : Promise.resolve({ data: [] }),
    inviterIds.length
      ? admin.from("profiles").select("id, display_name").in("id", inviterIds)
      : Promise.resolve({ data: [] }),
  ]);
  const spaceById = new Map((spaces ?? []).map((space) => [String(space.id), space]));
  const inviterById = new Map((inviters ?? []).map((profile) => [String(profile.id), profile]));

  return NextResponse.json({
    invitations: rows.map((row) => ({
      id: row.id,
      spaceId: row.space_id,
      projectTitle: spaceById.get(String(row.space_id))?.title || de.invitations.untitledProject,
      role: row.role,
      invitedBy: inviterById.get(String(row.invited_by))?.display_name || de.apiCopy.studioFallback,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })),
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await parseBody(req, z.object({
    invitationId: z.string().min(1).max(160),
    action: z.enum(["accept", "decline"]),
  }));
  if (!parsed.ok) return parsed.response;

  let emails: string[];
  try {
    emails = await verifiedEmails(userId);
  } catch {
    return NextResponse.json({ error: "account_unavailable" }, { status: 503 });
  }
  if (!emails.length) return NextResponse.json({ error: "email_not_verified" }, { status: 403 });

  const admin = supabaseAdmin();
  // Accepting inserts a project_members row (FK -> profiles); the row must exist.
  try {
    await ensureProfile(userId);
  } catch (profileErr) {
    console.error("[project-invitations] ensureProfile failed:", profileErr);
    return NextResponse.json({ error: "profile_unavailable" }, { status: 503 });
  }
  const { data, error } = await admin.rpc("respond_project_invitation", {
    p_invitation_id: parsed.data.invitationId,
    p_user_id: userId,
    p_verified_emails: emails,
    p_action: parsed.data.action,
  });
  if (invitationsUnavailable(error) || error?.code === "42883") {
    return NextResponse.json({ error: "project_invitations_migration_required" }, { status: 503 });
  }
  if (error) {
    console.error("[project-invitations] response failed:", error.message);
    return NextResponse.json({ error: "invitations_failed" }, { status: 500 });
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) return NextResponse.json({ error: "invitation_not_available" }, { status: 409 });
  return NextResponse.json({ ok: true, invitation: result });
}
