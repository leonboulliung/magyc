import { newId } from "@/lib/id";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

let warnedAuditUnavailable = false;

export async function recordAdminAudit(event: {
  adminUserId: string;
  action: string;
  targetType: "user" | "space" | "support_ticket";
  targetId: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const { error } = await admin.from("admin_audit_events").insert({
      id: newId(),
      admin_user_id: event.adminUserId,
      action: event.action.slice(0, 100),
      target_type: event.targetType,
      target_id: event.targetId,
      reason: event.reason?.trim().slice(0, 1000) || null,
      metadata: JSON.parse(JSON.stringify(event.metadata || {})),
    });
    if (error && !warnedAuditUnavailable) {
      warnedAuditUnavailable = true;
      console.warn("[admin_audit_events] insert failed:", error.message);
    }
  } catch (error) {
    if (!warnedAuditUnavailable) {
      warnedAuditUnavailable = true;
      console.warn("[admin_audit_events] unavailable:", (error as Error).message);
    }
  }
}
