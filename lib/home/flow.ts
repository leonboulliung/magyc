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

/** Map a flow error code to a clear German sentence. */
export function formatFlowError(message: string, extra?: { retryInSeconds?: unknown }): string {
  if (message === "timeout") return "Das hat zu lange gedauert. Bitte versuche es erneut.";
  if (message === "rate_limited" && typeof extra?.retryInSeconds === "number") {
    return `Bitte warte ${extra.retryInSeconds} Sekunden und versuche es erneut.`;
  }
  if (message === "input_too_short") return "Beschreibe den Fotografie-Auftrag bitte etwas genauer.";
  if (message === "input_not_photography_project") return "MAGYC plant Fotografie-Aufträge. Beschreibe bitte das Shooting, die Bildidee oder die gewünschte Übergabe.";
  if (message === "ai_not_configured") return "Die KI-Verbindung ist noch nicht eingerichtet.";
  if (message === "openai_rate_limited") return "Die KI ist gerade ausgelastet. Bitte versuche es erneut.";
  if (message === "clarify_failed" || message === "classify_failed") return "Die Anfrage konnte nicht verarbeitet werden. Bitte versuche es erneut.";
  return message;
}
