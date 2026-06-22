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

/** Map a flow error code to a friendly English sentence (the home is English). */
export function formatFlowError(message: string, extra?: { retryInSeconds?: unknown }): string {
  if (message === "timeout") return "This took too long. Please try again.";
  if (message === "rate_limited" && typeof extra?.retryInSeconds === "number") {
    return `Please wait ${extra.retryInSeconds}s and try again.`;
  }
  if (message === "input_too_short") return "Please add a little more detail.";
  if (message === "ai_not_configured") return "The AI backend is not configured yet.";
  if (message === "openai_rate_limited") return "The AI is busy right now. Please try again.";
  if (message === "clarify_failed" || message === "classify_failed") return "The request did not complete. Please try again.";
  return message;
}
