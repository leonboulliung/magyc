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
  if (raw === "claim_failed") return "Das Projekt konnte gerade nicht im Studio gespeichert werden.";
  if (raw === "publish_failed") return "Das Projekt konnte gerade nicht veroeffentlicht werden.";
  if (raw === "duplicate_failed") return "Das Projekt konnte gerade nicht dupliziert werden.";
  if (raw === "delete_failed") return "Das Projekt konnte gerade nicht geloescht werden.";
  if (raw === "update_failed") return "Die Aenderung konnte gerade nicht gespeichert werden.";
  if (raw === "modules_conflict") return "Das Projekt wurde gerade an anderer Stelle geaendert. Bitte kurz neu laden.";
  if (raw === "slot_taken") return "Dieser Platz wurde gerade von jemand anderem uebernommen.";
  if (raw === "rate_limited") return "Zu viele Aenderungen auf einmal. Bitte kurz warten.";
  if (raw === "state_limit_reached") return "Dieses Element enthält sehr viele Einträge. Entferne nicht mehr benötigte Inhalte, bevor du weitere hinzufügst.";
  if (raw === "presets_failed") return "Die Presets konnten gerade nicht gespeichert werden.";
  if (raw === "preset_state_migration_required") return "Preset-Inhalte brauchen noch das Datenbank-Update 022.";
  if (raw === "preset_not_saved") return "Das Preset wird noch gespeichert. Bitte den Upload gleich erneut versuchen.";
  if (raw === "preset_materialization_failed") return "Die Preset-Inhalte konnten nicht vollständig in das Projekt übernommen werden.";
  if (raw === "members_failed") return "Der Projektzugang konnte gerade nicht gespeichert werden.";
  if (raw === "project_members_migration_required") return "Projektrollen brauchen noch das Datenbank-Update 023.";
  if (raw === "member_is_owner") return "Die Inhaber:in hat bereits vollständigen Projektzugang.";
  if (raw === "support_failed") return "Deine Support-Anfrage konnte gerade nicht gesendet werden.";
  if (raw === "clerk_update_failed") return "Der Account-Status konnte bei Clerk gerade nicht geaendert werden.";
  if (raw === "upload_failed") return "Der Upload konnte gerade nicht vorbereitet werden.";
  if (raw === "mime_not_allowed") return "Dieser Dateityp ist für das Element nicht erlaubt.";
  if (raw === "upload_state_failed") return "Die Datei wurde nicht vollstaendig im Projekt gespeichert. Bitte erneut versuchen.";
  if (raw === "storage_sign_failed" || raw === "asset_sign_failed") return "Die Datei konnte gerade nicht sicher freigegeben werden. Bitte erneut versuchen.";
  if (raw === "storage_missing") return "Die Datei wurde nicht vollstaendig hochgeladen. Bitte erneut versuchen.";
  if (raw === "asset_delete_failed") return "Die Datei konnte nicht vollständig entfernt werden. Bitte erneut versuchen.";
  if (raw === "storage_quota_exceeded") return "Der Speicherplatz fuer dieses Projekt ist erreicht.";
  if (raw === "bad_asset_path" || raw === "upload_reference_required") return "Diese Datei konnte nicht eindeutig zugeordnet werden.";
  if (raw === "module_out_of_range") return "Dieses Element existiert nicht mehr. Bitte die Seite neu laden.";
  if (raw === "state_cleanup_failed" || raw === "state_check_failed") {
    return "Die Aenderung konnte nicht konsistent gespeichert werden. Bitte erneut versuchen.";
  }
  if (raw === "state_write_failed") return "Die Änderung konnte nicht konsistent gespeichert werden. Bitte erneut versuchen.";
  if (raw === "contract_signed") return "Unterschriebene Projekte sind gesperrt — der Plan kann nicht mehr geaendert werden.";
  if (raw === "bad_stage") return "Diese Projektphase ist nicht gueltig.";
  if (raw === "nothing_to_update") return "Es gab keine Aenderung zum Speichern.";
  if (raw === "owner_token_required" || raw === "owner_token_mismatch") {
    return "Dieser Entwurf kann in diesem Browser nicht mehr eindeutig zugeordnet werden.";
  }
  return raw.replace(/_/g, " ");
}

export function withOwnerToken(payload: Record<string, unknown>, ownerToken: string | null): Record<string, unknown> {
  return ownerToken ? { ...payload, anonOwnerToken: ownerToken } : payload;
}
