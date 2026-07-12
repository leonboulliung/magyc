import { activeClientDictionary } from "@/lib/client/locale";

/**
 * Home create-flow helpers — pure utilities shared by the landing page's
 * input → clarify → build orchestration. Extracted from app/page.tsx to keep
 * that component focused on the flow state machine (no behaviour change).
 */

/** Pull a human message out of an API error body, with a status fallback. */
export function apiError(json: unknown, status: number): string {
  const j = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const pick = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.message === "string") return o.message;
      if (typeof o.code === "string") return o.code;
    }
    return null;
  };
  return pick(j.detail) || pick(j.error) || (status === 504 ? "timeout" : `error ${status}`);
}

/** fetch + JSON parse with an abort timeout; "timeout" Error on abort. */
export async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Map a flow error code to a clear localized sentence. */
export function formatFlowError(message: string, extra?: { retryInSeconds?: unknown }): string {
  const errors = activeClientDictionary().flowErrors;
  if (message === "timeout") return errors.timeout;
  if (message === "rate_limited" && typeof extra?.retryInSeconds === "number") {
    return errors.waitSeconds.replace("{seconds}", String(extra.retryInSeconds));
  }
  if (message === "input_too_short") return errors.inputTooShort;
  if (message === "input_not_photography_project") return errors.notPhotography;
  if (message === "ai_not_configured") return errors.aiNotConfigured;
  if (message === "openai_rate_limited") return errors.aiBusy;
  if (message === "clarify_failed" || message === "classify_failed") return errors.requestFailed;
  return message;
}
