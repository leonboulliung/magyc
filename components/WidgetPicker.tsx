"use client";

import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { Module, ModuleType } from "@/lib/types";

/**
 * WidgetPicker — a compact dropdown listing all 26 body widget types,
 * grouped by domain. Labels are looked up from the space's detected
 * language so the picker never shows English on a non-English space.
 * Falls back to universal symbols when no translation exists.
 */

// ── Translation table ────────────────────────────────────────────────
// Covers the most common languages. Symbol fallback is always there.
// Keys are ISO 639-1 codes (matched case-insensitively, prefix-matched
// so "de-AT" resolves to "de").
type LangMap = Partial<Record<ModuleType, string>>;

const TRANSLATIONS: Record<string, LangMap> = {
  en: {
    ai_summary: "AI summary", icon: "Icon", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notes", discussion: "Chat", qa: "Q&A", poll: "Poll",
    crew: "Crew", work_packages: "Tasks", checklist: "Checklist",
    date: "Date", appointment: "Appointment", appointments: "Schedule",
    range: "Range", phases: "Phases",
    location_single: "Location", locations_multi: "Locations",
    location_suggestions: "Place ideas", route: "Route",
    table: "Table", parts_list: "Parts list",
    attachments: "Files", images: "Images", audio: "Audio", sketch: "Sketch",
  },
  de: {
    ai_summary: "KI-Einschätzung", icon: "Symbol", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notizen", discussion: "Diskussion", qa: "Fragen", poll: "Umfrage",
    crew: "Crew", work_packages: "Aufgaben", checklist: "Checkliste",
    date: "Datum", appointment: "Termin", appointments: "Termine",
    range: "Von – Bis", phases: "Phasen",
    location_single: "Ort", locations_multi: "Orte",
    location_suggestions: "Ortsvorschläge", route: "Route",
    table: "Tabelle", parts_list: "Utensilien",
    attachments: "Anhänge", images: "Bilder", audio: "Audio", sketch: "Skizze",
  },
  fr: {
    ai_summary: "Synthèse IA", icon: "Icône", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notes", discussion: "Discussion", qa: "Questions", poll: "Sondage",
    crew: "Équipe", work_packages: "Tâches", checklist: "Liste",
    date: "Date", appointment: "Rendez-vous", appointments: "Planning",
    range: "De – À", phases: "Phases",
    location_single: "Lieu", locations_multi: "Lieux",
    location_suggestions: "Suggestions", route: "Itinéraire",
    table: "Tableau", parts_list: "Matériel",
    attachments: "Fichiers", images: "Images", audio: "Audio", sketch: "Esquisse",
  },
  es: {
    ai_summary: "Resumen IA", icon: "Ícono", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notas", discussion: "Discusión", qa: "Preguntas", poll: "Encuesta",
    crew: "Equipo", work_packages: "Tareas", checklist: "Lista",
    date: "Fecha", appointment: "Cita", appointments: "Agenda",
    range: "De – A", phases: "Fases",
    location_single: "Lugar", locations_multi: "Lugares",
    location_suggestions: "Sugerencias", route: "Ruta",
    table: "Tabla", parts_list: "Materiales",
    attachments: "Archivos", images: "Imágenes", audio: "Audio", sketch: "Boceto",
  },
  it: {
    ai_summary: "Sintesi IA", icon: "Icona", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Note", discussion: "Discussione", qa: "Domande", poll: "Sondaggio",
    crew: "Team", work_packages: "Compiti", checklist: "Lista",
    date: "Data", appointment: "Appuntamento", appointments: "Agenda",
    range: "Da – A", phases: "Fasi",
    location_single: "Luogo", locations_multi: "Luoghi",
    location_suggestions: "Suggerimenti", route: "Percorso",
    table: "Tabella", parts_list: "Materiali",
    attachments: "File", images: "Immagini", audio: "Audio", sketch: "Schizzo",
  },
  pt: {
    ai_summary: "Resumo IA", icon: "Ícone", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notas", discussion: "Discussão", qa: "Perguntas", poll: "Enquete",
    crew: "Equipe", work_packages: "Tarefas", checklist: "Lista",
    date: "Data", appointment: "Compromisso", appointments: "Agenda",
    range: "De – A", phases: "Fases",
    location_single: "Local", locations_multi: "Locais",
    location_suggestions: "Sugestões", route: "Rota",
    table: "Tabela", parts_list: "Materiais",
    attachments: "Arquivos", images: "Imagens", audio: "Áudio", sketch: "Esboço",
  },
  nl: {
    ai_summary: "AI samenvatting", icon: "Icoon", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notities", discussion: "Discussie", qa: "Vragen", poll: "Enquête",
    crew: "Team", work_packages: "Taken", checklist: "Checklist",
    date: "Datum", appointment: "Afspraak", appointments: "Agenda",
    range: "Van – Tot", phases: "Fasen",
    location_single: "Locatie", locations_multi: "Locaties",
    location_suggestions: "Ideeën", route: "Route",
    table: "Tabel", parts_list: "Materialen",
    attachments: "Bestanden", images: "Afbeeldingen", audio: "Audio", sketch: "Schets",
  },
};

function getLangMap(lang: string): LangMap {
  const code = lang.toLowerCase().split("-")[0];
  return TRANSLATIONS[code] || TRANSLATIONS.en!;
}

function labelFor(type: ModuleType, lang: string): string {
  return getLangMap(lang)[type] || type.replace("_", " ");
}

// ── Group structure ──────────────────────────────────────────────────
interface PickerEntry { type: ModuleType; symbol: string }

const GROUPS: { symbol: string; entries: PickerEntry[] }[] = [
  {
    symbol: "✦",
    entries: [
      { type: "ai_summary", symbol: "✦" },
      { type: "icon",       symbol: "◈" },
      { type: "wikipedia",  symbol: "W" },
      { type: "gif",        symbol: "▷" },
    ],
  },
  {
    symbol: "↩",
    entries: [
      { type: "notes",      symbol: "≡" },
      { type: "discussion", symbol: "↩" },
      { type: "qa",         symbol: "?" },
      { type: "poll",       symbol: "○" },
    ],
  },
  {
    symbol: "●",
    entries: [
      { type: "crew",          symbol: "●" },
      { type: "work_packages", symbol: "□" },
      { type: "checklist",     symbol: "✓" },
    ],
  },
  {
    symbol: "▤",
    entries: [
      { type: "date",         symbol: "▤" },
      { type: "appointment",  symbol: "⏱" },
      { type: "appointments", symbol: "▦" },
      { type: "range",        symbol: "↔" },
      { type: "phases",       symbol: "→" },
    ],
  },
  {
    symbol: "⊙",
    entries: [
      { type: "location_single",      symbol: "⊙" },
      { type: "locations_multi",      symbol: "⊙⊙" },
      { type: "location_suggestions", symbol: "◎" },
      { type: "route",                symbol: "⟶" },
    ],
  },
  {
    symbol: "▦",
    entries: [
      { type: "table",      symbol: "▦" },
      { type: "parts_list", symbol: "≡" },
    ],
  },
  {
    symbol: "▨",
    entries: [
      { type: "attachments", symbol: "□" },
      { type: "images",      symbol: "▨" },
      { type: "audio",       symbol: "♫" },
      { type: "sketch",      symbol: "○" },
    ],
  },
];

// ── Default configs ──────────────────────────────────────────────────
function defaultWidget(type: ModuleType): Module | null {
  const now = new Date().toISOString();
  const today = now.split("T")[0];
  switch (type) {
    case "ai_summary":           return { type, text: "" };
    case "icon":                 return { type, iconify: "lucide:star" };
    case "wikipedia":            return { type, topic: "…" };
    case "gif":                  return { type, gifUrl: "https://media.tenor.com/RoFLtN1WqOwAAAAC/loading.gif", thumbnailUrl: "" };
    case "notes":                return { type };
    case "discussion":           return { type };
    case "qa":                   return { type };
    case "poll":                 return { type, question: "?", options: ["A", "B", "C"] };
    case "crew":                 return { type, roles: [{ name: "…" }] };
    case "work_packages":        return { type, packages: [{ label: "…" }] };
    case "checklist":            return { type, items: [] };
    case "date":                 return { type, date: today };
    case "appointment":          return { type, datetime: now };
    case "appointments":         return { type, entries: [] };
    case "range":                return { type, unit: "generic", from: "—", to: "—" };
    case "phases":               return { type, phases: [{ label: "I" }, { label: "II" }, { label: "III" }], currentPhase: 0 };
    case "location_single":      return { type, center: [2.3522, 48.8566], zoom: 13, label: "Paris" };
    case "locations_multi":      return { type, locations: [] };
    case "location_suggestions": return { type, suggestions: [] };
    case "route":                return { type, stops: [] };
    case "table":                return { type, columns: ["A", "B", "C"], rows: [["", "", ""]] };
    case "parts_list":           return { type, items: [] };
    case "attachments":          return { type };
    case "images":               return { type };
    case "audio":                return { type };
    case "sketch":               return { type };
    default:                     return null;
  }
}

// ── Component ────────────────────────────────────────────────────────
export function WidgetPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (widget: Module) => void;
}) {
  const ctx = useWidgetContext();
  const lang = ctx.language || "en";

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-full mb-2 left-1/2 z-50 rounded-md overflow-hidden"
            style={{
              width: 280,
              transform: "translateX(-50%)",
              background: "var(--v-bg)",
              border: "1px solid var(--v-rule)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              maxHeight: "min(60vh, 380px)",
              overflowY: "auto",
            }}
          >
            {GROUPS.map((group, gi) => (
              <div key={gi} style={{ borderBottom: gi < GROUPS.length - 1 ? "1px solid var(--v-rule)" : "none" }}>
                <div className="grid grid-cols-2 gap-0.5 p-1.5">
                  {group.entries.map((e) => (
                    <motion.button
                      key={e.type}
                      type="button"
                      onClick={() => {
                        const w = defaultWidget(e.type);
                        if (w) { onPick(w); onClose(); }
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded text-left"
                      whileHover={{ background: "rgba(0,0,0,0.04)" }}
                      transition={{ duration: 0.1 }}
                    >
                      <span
                        className="mono text-[11px] shrink-0 w-4 text-center"
                        style={{ color: "var(--v-muted)" }}
                      >
                        {e.symbol}
                      </span>
                      <span className="text-[11px] truncate" style={{ color: "var(--v-fg)" }}>
                        {labelFor(e.type, lang)}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
