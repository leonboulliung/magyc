"use client";

import { motion } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { Module, ModuleType } from "@/lib/types";

/**
 * WidgetPicker — a compact dropdown listing the active body widget types,
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
    crew: "Crew", work_packages: "Tasks", deliverables: "Deliverables", approvals: "Approvals", checklist: "Checklist",
    date: "Date", appointment: "Appointment", appointments: "Schedule",
    range: "Range", phases: "Phases",
    location_single: "Location", locations_multi: "Locations",
    location_suggestions: "Place ideas", route: "Route",
    table: "Table", shot_list: "Shotlist", parts_list: "Parts list",
    attachments: "Files", images: "Images", moodboard: "Moodboard", audio: "Audio", sketch: "Sketch",
  },
  de: {
    ai_summary: "KI-Einschätzung", icon: "Symbol", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notizen", discussion: "Diskussion", qa: "Fragen", poll: "Umfrage",
    crew: "Crew", work_packages: "Aufgaben", deliverables: "Ergebnisse", approvals: "Freigaben", checklist: "Checkliste",
    date: "Datum", appointment: "Termin", appointments: "Termine",
    range: "Von – Bis", phases: "Phasen",
    location_single: "Ort", locations_multi: "Orte",
    location_suggestions: "Ortsvorschläge", route: "Route",
    table: "Tabelle", shot_list: "Shotlist", parts_list: "Utensilien",
    attachments: "Anhänge", images: "Bilder", moodboard: "Moodboard", audio: "Audio", sketch: "Skizze",
  },
  fr: {
    ai_summary: "Synthèse IA", icon: "Icône", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notes", discussion: "Discussion", qa: "Questions", poll: "Sondage",
    crew: "Équipe", work_packages: "Tâches", deliverables: "Livrables", approvals: "Validations", checklist: "Liste",
    date: "Date", appointment: "Rendez-vous", appointments: "Planning",
    range: "De – À", phases: "Phases",
    location_single: "Lieu", locations_multi: "Lieux",
    location_suggestions: "Suggestions", route: "Itinéraire",
    table: "Tableau", shot_list: "Plan de prises", parts_list: "Matériel",
    attachments: "Fichiers", images: "Images", moodboard: "Moodboard", audio: "Audio", sketch: "Esquisse",
  },
  es: {
    ai_summary: "Resumen IA", icon: "Ícono", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notas", discussion: "Discusión", qa: "Preguntas", poll: "Encuesta",
    crew: "Equipo", work_packages: "Tareas", deliverables: "Entregables", approvals: "Aprobaciones", checklist: "Lista",
    date: "Fecha", appointment: "Cita", appointments: "Agenda",
    range: "De – A", phases: "Fases",
    location_single: "Lugar", locations_multi: "Lugares",
    location_suggestions: "Sugerencias", route: "Ruta",
    table: "Tabla", shot_list: "Lista de tomas", parts_list: "Materiales",
    attachments: "Archivos", images: "Imágenes", moodboard: "Moodboard", audio: "Audio", sketch: "Boceto",
  },
  it: {
    ai_summary: "Sintesi IA", icon: "Icona", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Note", discussion: "Discussione", qa: "Domande", poll: "Sondaggio",
    crew: "Team", work_packages: "Compiti", deliverables: "Deliverable", approvals: "Approvazioni", checklist: "Lista",
    date: "Data", appointment: "Appuntamento", appointments: "Agenda",
    range: "Da – A", phases: "Fasi",
    location_single: "Luogo", locations_multi: "Luoghi",
    location_suggestions: "Suggerimenti", route: "Percorso",
    table: "Tabella", shot_list: "Shotlist", parts_list: "Materiali",
    attachments: "File", images: "Immagini", moodboard: "Moodboard", audio: "Audio", sketch: "Schizzo",
  },
  pt: {
    ai_summary: "Resumo IA", icon: "Ícone", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notas", discussion: "Discussão", qa: "Perguntas", poll: "Enquete",
    crew: "Equipe", work_packages: "Tarefas", deliverables: "Entregas", approvals: "Aprovações", checklist: "Lista",
    date: "Data", appointment: "Compromisso", appointments: "Agenda",
    range: "De – A", phases: "Fases",
    location_single: "Local", locations_multi: "Locais",
    location_suggestions: "Sugestões", route: "Rota",
    table: "Tabela", shot_list: "Lista de fotos", parts_list: "Materiais",
    attachments: "Arquivos", images: "Imagens", moodboard: "Moodboard", audio: "Áudio", sketch: "Esboço",
  },
  nl: {
    ai_summary: "AI samenvatting", icon: "Icoon", wikipedia: "Wikipedia", gif: "GIF",
    notes: "Notities", discussion: "Discussie", qa: "Vragen", poll: "Enquête",
    crew: "Team", work_packages: "Taken", deliverables: "Deliverables", approvals: "Goedkeuringen", checklist: "Checklist",
    date: "Datum", appointment: "Afspraak", appointments: "Agenda",
    range: "Van – Tot", phases: "Fasen",
    location_single: "Locatie", locations_multi: "Locaties",
    location_suggestions: "Ideeën", route: "Route",
    table: "Tabel", shot_list: "Shotlist", parts_list: "Materialen",
    attachments: "Bestanden", images: "Afbeeldingen", moodboard: "Moodboard", audio: "Audio", sketch: "Schets",
  },
};

function getLangMap(lang: string): LangMap {
  const code = lang.toLowerCase().split("-")[0];
  return TRANSLATIONS[code] || TRANSLATIONS.en!;
}

/**
 * Resolve a widget label. Priority:
 *   1. emergent — the AI-generated label in the space's language
 *      (space.labels.widgetLabels), so the picker has no static system
 *      language;
 *   2. the built-in translation table for the space language;
 *   3. the raw type name.
 */
function labelFor(type: ModuleType, lang: string, emergent?: Record<string, string>): string {
  if (emergent && typeof emergent[type] === "string" && emergent[type].trim()) {
    return emergent[type];
  }
  return getLangMap(lang)[type] || type.replace("_", " ");
}

// ── Group structure ──────────────────────────────────────────────────
interface PickerEntry { type: ModuleType; symbol: string }

const GROUPS: { symbol: string; entries: PickerEntry[] }[] = [
  {
    symbol: "▧",
    entries: [
      { type: "moodboard",   symbol: "▧" },
      { type: "shot_list",   symbol: "▤" },
      { type: "images",      symbol: "▨" },
      { type: "attachments", symbol: "□" },
      { type: "parts_list",  symbol: "≡" },
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
      { type: "deliverables",  symbol: "≣" },
      { type: "approvals",     symbol: "✓" },
      { type: "checklist",     symbol: "✓" },
    ],
  },
  {
    symbol: "▤",
    entries: [
      { type: "date",         symbol: "▤" },
      { type: "appointment",  symbol: "◷" },
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
    ],
  },
  {
    symbol: "✦",
    entries: [
      { type: "ai_summary", symbol: "✦" },
      { type: "audio",       symbol: "♫" },
      { type: "sketch",      symbol: "○" },
    ],
  },
];

// ── Default configs ──────────────────────────────────────────────────
export function defaultWidget(type: ModuleType): Module | null {
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
    case "deliverables":         return { type, items: [{ label: "…" }] };
    case "approvals":            return { type, items: [{ text: "…" }] };
    case "checklist":            return { type, items: [] };
    case "date":                 return { type, date: today };
    case "appointment":          return { type, datetime: now };
    case "appointments":         return { type, entries: [{ datetime: now, label: "…" }] };
    case "range":                return { type, unit: "generic", from: "—", to: "—" };
    case "phases":               return { type, phases: [{ label: "I" }, { label: "II" }, { label: "III" }], currentPhase: 0 };
    case "location_single":      return { type, center: [2.3522, 48.8566], zoom: 13, label: "Paris" };
    case "locations_multi":      return { type, locations: [{ lng: 2.3522, lat: 48.8566, label: "…" }] };
    case "location_suggestions": return { type, suggestions: [{ label: "…" }] };
    case "route":                return { type, stops: [{ lng: 2.3522, lat: 48.8566, label: "A" }, { lng: 2.3601, lat: 48.8529, label: "B" }] };
    case "table":                return { type, columns: ["A", "B", "C"], rows: [["", "", ""]] };
    case "shot_list":            return { type, shots: [{ label: "…", priority: "must", status: "planned" }] };
    case "parts_list":           return { type, items: [{ name: "…" }] };
    case "attachments":          return { type };
    case "images":               return { type };
    case "moodboard":            return { type, directions: [{ label: "…" }] };
    case "audio":                return { type };
    case "sketch":               return { type };
    default:                     return null;
  }
}

// ── Content ──────────────────────────────────────────────────────────
// Just the grouped grid of widget types. Dismissal / positioning /
// focus are owned by the Radix Popover this is rendered inside.
export function WidgetPickerContent({ onPick }: { onPick: (widget: Module) => void }) {
  const ctx = useWidgetContext();
  const lang = ctx.language || "en";
  const emergent = ctx.labels.widgetLabels;

  return (
    // Width and scrolling are owned by the container (desktop popover /
    // mobile sheet). Keeping this layer unscrollable prevents nested
    // scroll areas, which felt sticky and unnatural in the picker.
    <div style={{ width: "100%" }}>
      {GROUPS.map((group, gi) => (
        <div key={gi} style={{ borderBottom: gi < GROUPS.length - 1 ? "1px solid var(--v-rule)" : "none" }}>
          <div
            className="grid gap-0.5 p-1.5"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))" }}
          >
            {group.entries.map((e) => (
              <motion.button
                key={e.type}
                type="button"
                onClick={() => {
                  const w = defaultWidget(e.type);
                  if (w) onPick(w);
                }}
                title={labelFor(e.type, lang, emergent)}
                className="flex items-center gap-2.5 px-3 py-3 rounded text-left min-h-[44px]"
                whileHover={{ background: "rgba(0,0,0,0.04)" }}
                transition={{ duration: 0.1 }}
              >
                <span className="mono text-[12px] shrink-0 w-4 text-center" style={{ color: "var(--v-muted)" }}>
                  {e.symbol}
                </span>
                <span className="text-[12px] truncate" style={{ color: "var(--v-fg)" }}>
                  {labelFor(e.type, lang, emergent)}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      ))}
      <div
        className="px-3 py-2 mono text-[9px] tracking-widest opacity-45"
        style={{ borderTop: "1px solid var(--v-rule)", color: "var(--v-muted)" }}
      >
        heading + text + tags stay fixed at the top
      </div>
    </div>
  );
}
