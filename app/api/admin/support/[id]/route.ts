import { NextResponse } from "next/server";
import { z } from "zod";
import { SUPPORT_STATUSES } from "@/lib/adminAccount";
import { requireAdmin } from "@/lib/admin";
import { parseBody } from "@/lib/api/validate";
import { recordAdminAudit } from "@/lib/server/adminAudit";
import { recordAppEvent } from "@/lib/server/observability";
import { ensureProfile } from "@/lib/server/profile";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

const bodySchema = z.object({
  status: z.enum(SUPPORT_STATUSES),
  reason: z.string().max(1000).optional(),
});

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

  await ensureProfile(gate.userId).catch(() => undefined);

  const update = parsed.data.status === "done"
    ? { status: "done", done_at: new Date().toISOString(), done_by: gate.userId }
    : { status: "new", done_at: null, done_by: null };

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("support_tickets")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[admin/support] update failed:", error.message);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await recordAdminAudit({
    adminUserId: gate.userId,
    action: `support.${parsed.data.status}`,
    targetType: "support_ticket",
    targetId: id,
    reason: parsed.data.reason || null,
    metadata: { status: parsed.data.status },
  });
  await recordAppEvent({
    eventType: "admin.support.updated",
    status: "ok",
    route: `/api/admin/support/${id}`,
    method: "PATCH",
    userId: gate.userId,
    actorKind: "user",
    actorId: gate.userId,
    metadata: { ticketId: id, status: parsed.data.status },
  });

  return NextResponse.json({ ok: true });
}
