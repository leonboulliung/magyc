/**
 * German dictionary — the SOURCE OF TRUTH for the string shape. Every other
 * locale (en.ts) is typed as `typeof de`, so a missing key fails typecheck.
 * Grow this per migration phase; keep keys grouped by surface.
 */
export const de = {
  common: {
    save: "Speichern",
    cancel: "Abbrechen",
    add: "Hinzufügen",
    remove: "Entfernen",
    delete: "Löschen",
    edit: "Bearbeiten",
    close: "Schließen",
    back: "Zurück",
    next: "Weiter",
    open: "Öffnen",
    loading: "Lädt …",
    saving: "Speichert …",
    saved: "Gespeichert",
    error: "Fehler",
    retry: "Erneut versuchen",
    confirm: "Bestätigen",
    yes: "Ja",
    no: "Nein",
    optional: "optional",
    fullscreen: "Vollbild",
  },
  language: {
    label: "Sprache",
    german: "Deutsch",
    english: "Englisch",
    switchTo: "Auf Englisch umschalten",
  },
};

export type Dictionary = typeof de;
