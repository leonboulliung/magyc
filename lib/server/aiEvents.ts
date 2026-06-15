import { newId } from "@/lib/id";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_TEXT = 12_000;

function clip(value: unknown, max = MAX_TEXT): string | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/\s+/g, " ").trim().slice(0, max) || null;
}

export interface AiEventInput {
  userId?: string | null;
  anonId?: string | null;
  spaceId?: string | null;
  moduleIndex?: number | null;
  eventType: string;
  model?: string | null;
  status?: "ok" | "error";
  input?: unknown;
  output?: unknown;
  error?: unknown;
  metadata?: Record<string, unknown>;
  latencyMs?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
}

/**
 * Best-effort AI observability. This must never break the product path:
 * if Supabase is unavailable or the migration is not applied yet, the
 * user-facing AI call still succeeds and we log a server warning.
 */
export async function recordAiEvent(event: AiEventInput): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const { error } = await admin.from("ai_events").insert({
      id: newId(),
      user_id: event.userId || null,
      anon_id: event.anonId || null,
      space_id: event.spaceId || null,
      module_index: typeof event.moduleIndex === "number" ? event.moduleIndex : null,
      event_type: event.eventType.slice(0, 80),
      model: event.model || null,
      status: event.status ?? "ok",
      input: clip(event.input),
      output: clip(event.output),
      error: clip(event.error, 2000),
      metadata: event.metadata ?? {},
      latency_ms:
        typeof event.latencyMs === "number" && Number.isFinite(event.latencyMs)
          ? Math.max(0, Math.round(event.latencyMs))
          : null,
      tokens_in:
        typeof event.tokensIn === "number" && Number.isFinite(event.tokensIn)
          ? Math.max(0, Math.round(event.tokensIn))
          : null,
      tokens_out:
        typeof event.tokensOut === "number" && Number.isFinite(event.tokensOut)
          ? Math.max(0, Math.round(event.tokensOut))
          : null,
    });
    if (error) {
      console.warn("[ai_events] insert failed:", error.message);
    }
  } catch (error) {
    console.warn("[ai_events] unavailable:", (error as Error).message);
  }
}
