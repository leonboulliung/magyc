import { bodyTypes, sanitizeModule } from "@/lib/modules";
import type { Module, ModuleType } from "@/lib/types";

export type StudioPreset = {
  id: string;
  name: string;
  description: string;
  modules: Module[];
  promptInjections: string[];
  allowContextModules: boolean;
};

export const STUDIO_PRESETS_STORAGE_KEY = "magyc.studio.presets.v3";

export const HIDDEN_PRESET_TYPES = new Set<ModuleType>([
  "wikipedia",
  "gif",
  "icon",
  "ai_summary",
  "notes",
  "discussion",
  "sketch",
]);

export const PRESET_ELEMENT_TYPES = bodyTypes().filter((type) => !HIDDEN_PRESET_TYPES.has(type));
export const PRESET_ELEMENT_TYPE_SET = new Set(PRESET_ELEMENT_TYPES);

export const DEFAULT_STUDIO_PRESETS: StudioPreset[] = [
  {
    id: "product",
    name: "Produktshooting",
    description: "Packshots, Editorials und Webshop-Serien.",
    modules: [
      { type: "moodboard", microTitle: "Moodboard", directions: [{ label: "Licht & Look" }, { label: "Material / Textur" }] },
      { type: "shot_list", microTitle: "Shotlist", shots: [
        { label: "Hero-Aufnahme", priority: "must", status: "planned" },
        { label: "Detail / Prozess", priority: "should", status: "planned" },
      ] },
      { type: "table", microTitle: "Technikliste", columns: ["Bereich", "Vorgabe"], rows: [["Kamera", ""], ["Objektiv", ""], ["Licht", ""]] },
      { type: "deliverables", microTitle: "Deliverables", items: [{ label: "Webshop" }, { label: "Social Crops" }] },
      { type: "approvals", microTitle: "Freigaben", items: [{ text: "Look freigeben" }, { text: "Finale Auswahl freigeben" }] },
    ],
    promptInjections: [
      "Plane wie ein kommerzieller Produktfotograf: Deliverables, Nutzungsrechte, Shotlist und Freigaben explizit machen.",
    ],
    allowContextModules: true,
  },
  {
    id: "wedding",
    name: "Hochzeit",
    description: "Ablauf, Orte, Must-have-Motive und Übergabe.",
    modules: [
      { type: "shot_list", microTitle: "Must-have-Motive", shots: [
        { label: "Getting Ready", priority: "must", status: "planned" },
        { label: "Trauung", priority: "must", status: "planned" },
        { label: "Gruppenbilder", priority: "must", status: "planned" },
      ] },
      { type: "locations_multi", microTitle: "Orte", locations: [
        { lng: 13.4049, lat: 52.52, label: "Trauung" },
        { lng: 13.3903, lat: 52.5076, label: "Feier" },
      ] },
      { type: "appointment", microTitle: "Termin", datetime: new Date().toISOString() },
      { type: "checklist", microTitle: "Vorbereitung", items: [{ text: "Ablauf bestätigen" }, { text: "Kontaktperson klären" }] },
      { type: "deliverables", microTitle: "Übergabe", items: [{ label: "Online-Galerie" }, { label: "Highlight-Auswahl" }] },
    ],
    promptInjections: ["Sensible Kommunikation, klare Timings und Must-have-Momente priorisieren."],
    allowContextModules: true,
  },
];

export const MARKETING_STARTER_PRESETS: StudioPreset[] = [
  {
    id: "starter-product",
    name: "Produktshooting",
    description: "Webshop, Kampagne, Packshots und Social-Crops.",
    modules: [
      { type: "moodboard", microTitle: "Moodboard", directions: [
        { label: "Licht & Look", status: "reference" },
        { label: "Material / Textur", status: "reference" },
        { label: "No-Gos", status: "avoid" },
      ] },
      { type: "shot_list", microTitle: "Shotlist", shots: [
        { label: "Hero-Aufnahme", purpose: "Key Visual / Website", priority: "must", status: "planned" },
        { label: "Detail / Textur", purpose: "Produktmerkmale sichtbar machen", priority: "should", status: "planned" },
      ] },
      { type: "table", microTitle: "Technikliste", columns: ["Bereich", "Vorgabe"], rows: [["Kamera", ""], ["Objektiv", ""], ["Licht", ""]] },
      { type: "deliverables", microTitle: "Deliverables", items: [
        { label: "Webshop", format: "JPG", status: "planned" },
        { label: "Social Media", format: "Crops", status: "planned" },
      ] },
      { type: "approvals", microTitle: "Freigaben", items: [
        { text: "Bildsprache freigeben", audience: "client", status: "pending" },
        { text: "Finale Auswahl freigeben", audience: "client", status: "pending" },
      ] },
      { type: "checklist", microTitle: "Vorbereitung", items: [{ text: "Produkte reinigen / vorbereiten" }, { text: "Referenzen einsammeln" }] },
    ],
    promptInjections: [
      "Plane wie ein kommerzieller Produktfotograf in Deutschland: Bildsprache, Shotlist, Nutzungsrechte, Formate, Freigaben und Übergabetermin klar machen.",
    ],
    allowContextModules: true,
  },
  {
    id: "starter-wedding",
    name: "Hochzeit",
    description: "Ablauf, Orte, Must-have-Motive und Übergabe.",
    modules: [
      { type: "appointments", microTitle: "Zeitplan", entries: [] },
      { type: "locations_multi", microTitle: "Orte", locations: [] },
      { type: "shot_list", microTitle: "Must-have-Motive", shots: [
        { label: "Getting Ready", priority: "must", status: "planned" },
        { label: "Trauung", priority: "must", status: "planned" },
        { label: "Gruppenbilder", priority: "must", status: "planned" },
        { label: "Paarshooting", priority: "must", status: "planned" },
      ] },
      { type: "crew", microTitle: "Kontakte", roles: [{ name: "Brautpaar" }, { name: "Trauzeug:innen" }, { name: "Locationkontakt" }] },
      { type: "deliverables", microTitle: "Übergabe", items: [
        { label: "Online-Galerie", status: "planned" },
        { label: "Highlight-Auswahl", status: "planned" },
      ] },
      { type: "checklist", microTitle: "Vorbereitung", items: [{ text: "Ablaufplan bestätigen" }, { text: "Gruppenbildliste einsammeln" }] },
    ],
    promptInjections: [
      "Plane sensibel und zuverlässig für eine Hochzeit in Deutschland: Ablauf, Orte, Kontaktpersonen, Must-have-Motive, Backup-Plan und Bildübergabe priorisieren.",
    ],
    allowContextModules: true,
  },
  {
    id: "starter-business-portrait",
    name: "Business-Portrait",
    description: "Personal Branding, LinkedIn, Website und Teamfotos.",
    modules: [
      { type: "rich_text", microTitle: "Briefing", text: "Ziel, Zielgruppe, Einsatzorte und gewünschte Wirkung der Portraits festhalten." },
      { type: "moodboard", microTitle: "Bildsprache", directions: [
        { label: "Professionell / nahbar", status: "reference" },
        { label: "Hintergrund & Licht", status: "reference" },
      ] },
      { type: "locations_multi", microTitle: "Location", locations: [] },
      { type: "parts_list", microTitle: "Styling / Requisiten", items: [{ name: "Outfit 1" }, { name: "Outfit 2" }] },
      { type: "shot_list", microTitle: "Shotlist", shots: [
        { label: "LinkedIn Portrait", priority: "must", status: "planned" },
        { label: "Website Hero", priority: "should", status: "planned" },
        { label: "Arbeitsmoment / Kontext", priority: "nice", status: "planned" },
      ] },
      { type: "deliverables", microTitle: "Deliverables", items: [
        { label: "LinkedIn / Profilbild", format: "Quadrat", status: "planned" },
        { label: "Website", format: "Querformat", status: "planned" },
      ] },
    ],
    promptInjections: [
      "Plane Business-Portraits mit Fokus auf Wirkung, Vertrauen, Einsatzkanäle, Styling, Location und klare Auswahlrunde.",
    ],
    allowContextModules: true,
  },
  {
    id: "starter-event",
    name: "Event-Reportage",
    description: "Konferenz, Firmenveranstaltung, Launch oder Kultur-Event.",
    modules: [
      { type: "appointments", microTitle: "Ablauf", entries: [] },
      { type: "locations_multi", microTitle: "Location-Plan", locations: [] },
      { type: "crew", microTitle: "Team & Rollen", roles: [{ name: "Fotograf:in" }, { name: "Ansprechpartner:in" }, { name: "Social / Presse" }] },
      { type: "shot_list", microTitle: "Shotlist", shots: [
        { label: "Atmosphäre / Raum", priority: "must", status: "planned" },
        { label: "Keynote / Programmpunkt", priority: "must", status: "planned" },
        { label: "Gäste / Interaktion", priority: "should", status: "planned" },
        { label: "Branding / Details", priority: "should", status: "planned" },
      ] },
      { type: "table", microTitle: "Technikliste", columns: ["Bereich", "Vorgabe"], rows: [["Kamera", ""], ["Objektiv", ""], ["Licht / Blitz", ""]] },
      { type: "deliverables", microTitle: "Deliverables", items: [
        { label: "Presseauswahl", due: "zeitnah", status: "planned" },
        { label: "Gesamtübergabe", status: "planned" },
      ] },
    ],
    promptInjections: [
      "Plane eine Event-Reportage mit Fokus auf Ablauf, Ansprechpartner, kritische Programmpunkte, schnelle Auswahl und saubere Übergabe.",
    ],
    allowContextModules: true,
  },
];

export function createStudioPreset(): StudioPreset {
  return {
    id: `preset-${Date.now()}`,
    name: "Neues Preset",
    description: "",
    modules: [],
    promptInjections: [""],
    allowContextModules: true,
  };
}

function cleanPresetId(raw: unknown, fallbackIndex: number): string {
  const source = typeof raw === "string" ? raw : `preset-${fallbackIndex}`;
  const cleaned = source
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return cleaned || `preset-${fallbackIndex}`;
}

function uniquePresetIds(presets: StudioPreset[]): StudioPreset[] {
  const seen = new Set<string>();
  return presets.map((preset, index) => {
    const base = cleanPresetId(preset.id, index);
    let id = base;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);
    return id === preset.id ? preset : { ...preset, id };
  });
}

export function cleanStudioPresets(raw: unknown): StudioPreset[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed = raw
    .map((item, index) => {
      const candidate = item as Partial<StudioPreset>;
      const modules = Array.isArray(candidate.modules)
        ? candidate.modules
            .map(sanitizeModule)
            .filter((module): module is Module => !!module && PRESET_ELEMENT_TYPE_SET.has(module.type))
        : [];
      const id = cleanPresetId(candidate.id, index);
      const name = typeof candidate.name === "string"
        ? candidate.name.replace(/\s+/g, " ").trim().slice(0, 120)
        : "";
      return {
        id,
        name: name || "Unbenanntes Preset",
        description: typeof candidate.description === "string" ? candidate.description.slice(0, 500) : "",
        modules,
        promptInjections: Array.isArray(candidate.promptInjections)
          ? candidate.promptInjections
              .filter((prompt): prompt is string => typeof prompt === "string")
              .map((prompt) => prompt.slice(0, 500))
          : [""],
        allowContextModules: candidate.allowContextModules !== false,
      };
    })
    .filter(Boolean) as StudioPreset[];
  return uniquePresetIds(parsed);
}
