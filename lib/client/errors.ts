export function apiErrorMessage(json: unknown, fallback = "Aktion fehlgeschlagen. Bitte erneut versuchen."): string {
  if (!json || typeof json !== "object") return fallback;
  const data = json as Record<string, unknown>;
  const raw = typeof data.detail === "string" && data.detail.trim()
    ? data.detail.trim()
    : typeof data.error === "string" && data.error.trim()
      ? data.error.trim()
      : "";
  if (!raw) return fallback;
  if (raw === "invalid_body") return "Die Anfrage war unvollständig. Bitte erneut versuchen.";
  if (raw === "forbidden") return "Du hast fuer dieses Projekt keine Bearbeitungsrechte.";
  if (raw === "widget_invalid") return "Dieses Element konnte nicht angelegt werden.";
  if (raw === "not_found") return "Das Projekt wurde nicht gefunden.";
  if (raw === "save_failed") return "Speichern fehlgeschlagen. Bitte erneut versuchen.";
  return raw.replace(/_/g, " ");
}

export function withOwnerToken(payload: Record<string, unknown>, ownerToken: string | null): Record<string, unknown> {
  return ownerToken ? { ...payload, anonOwnerToken: ownerToken } : payload;
}
