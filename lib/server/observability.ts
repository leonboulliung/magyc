import { newId } from "@/lib/id";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

const MAX_TEXT = 4000;
let warnedAppEventsUnavailable = false;

function clip(value: unknown, max = MAX_TEXT): string | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/\s+/g, " ").trim().slice(0, max) || null;
}

function cleanMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) return {};
  return JSON.parse(JSON.stringify(value));
}

export interface AppEventInput {
  eventType: string;
  status?: "ok" | "warn" | "error";
  route?: string | null;
  method?: string | null;
  userId?: string | null;
  anonId?: string | null;
  actorKind?: "user" | "anon" | null;
  actorId?: string | null;
  spaceId?: string | null;
  latencyMs?: number | null;
  error?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort product operations telemetry. App-events are intentionally
 * non-critical: a missing migration or Supabase hiccup must never block a
 * project, upload, or customer-facing action.
 */
export async function recordAppEvent(event: AppEventInput): Promise<void> {
  if (!FEATURE_FLAGS.appEvents) return;
  try {
    const admin = supabaseAdmin();
    const { error } = await admin.from("app_events").insert({
      id: newId(),
      event_type: event.eventType.slice(0, 100),
      status: event.status ?? "ok",
      route: event.route || null,
      method: event.method || null,
      user_id: event.userId || null,
      anon_id: event.anonId || null,
      actor_kind: event.actorKind || null,
      actor_id: event.actorId || null,
      space_id: event.spaceId || null,
      latency_ms:
        typeof event.latencyMs === "number" && Number.isFinite(event.latencyMs)
          ? Math.max(0, Math.round(event.latencyMs))
          : null,
      error: clip(event.error, 2000),
      metadata: cleanMetadata(event.metadata),
    });
    if (error && !warnedAppEventsUnavailable) {
      warnedAppEventsUnavailable = true;
      console.warn("[app_events] insert failed:", error.message);
    }
  } catch (error) {
    if (!warnedAppEventsUnavailable) {
      warnedAppEventsUnavailable = true;
      console.warn("[app_events] unavailable:", (error as Error).message);
    }
  }
}
