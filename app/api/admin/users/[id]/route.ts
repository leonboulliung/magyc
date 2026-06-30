import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { ACCOUNT_STATUSES, ADMIN_PLANS, type AccountStatus } from "@/lib/adminAccount";
import { requireAdmin } from "@/lib/admin";
import { parseBody } from "@/lib/api/validate";
import { recordAdminAudit } from "@/lib/server/adminAudit";
import { recordAppEvent } from "@/lib/server/observability";
import { ensureProfile } from "@/lib/server/profile";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

const bodySchema = z.object({
  plan: z.enum(ADMIN_PLANS).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  adminNotes: z.string().max(4000).optional(),
  reason: z.string().max(1000).optional(),
});

async function applyClerkStatus(userId: string, status: AccountStatus): Promise<void> {
  const client = await clerkClient();
  if (status === "banned") {
    await client.users.banUser(userId);
    return;
  }
  if (status === "locked") {
    await client.users.lockUser(userId);
    return;
  }

  // Re-activating an account may require undoing either state. Clerk returns
  // errors when a user was not in that state; for activation we keep those
  // idempotent and continue.
  await client.users.unbanUser(userId).catch(() => undefined);
  await client.users.unlockUser(userId).catch(() => undefined);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (!gate.ok || !gate.userId) {
    return NextResponse.json({ error: gate.reason || "forbidden" }, { status: gate.reason === "signed_out" ? 401 : 403 });
  }

  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const update: Record<string, unknown> = {};
  if (parsed.data.plan) {
    update.plan = parsed.data.plan;
    update.plan_updated_at = new Date().toISOString();
  }
  if (parsed.data.status) {
    try {
      await applyClerkStatus(id, parsed.data.status);
    } catch (error) {
      await recordAppEvent({
        eventType: "admin.user.status.clerk_failed",
        status: "error",
        route: `/api/admin/users/${id}`,
        method: "PATCH",
        userId: gate.userId,
        actorKind: "user",
        actorId: gate.userId,
        error,
        metadata: { targetUserId: id, requestedStatus: parsed.data.status },
      });
      return NextResponse.json({ error: "clerk_update_failed" }, { status: 502 });
    }
    update.account_status = parsed.data.status;
    update.account_status_updated_at = new Date().toISOString();
  }
  if (typeof parsed.data.adminNotes === "string") {
    update.admin_notes = parsed.data.adminNotes.trim().slice(0, 4000);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  await ensureProfile(gate.userId).catch(() => undefined);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[admin/users] update failed:", error.message);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await recordAdminAudit({
    adminUserId: gate.userId,
    action: "user.updated",
    targetType: "user",
    targetId: id,
    reason: parsed.data.reason || null,
    metadata: update,
  });
  await recordAppEvent({
    eventType: "admin.user.updated",
    status: "ok",
    route: `/api/admin/users/${id}`,
    method: "PATCH",
    userId: gate.userId,
    actorKind: "user",
    actorId: gate.userId,
    metadata: { targetUserId: id, changed: Object.keys(update) },
  });

  return NextResponse.json({ ok: true });
}
