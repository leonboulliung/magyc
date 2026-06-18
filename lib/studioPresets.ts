import { bodyTypes } from "@/lib/modules";
import type { Module, ModuleType } from "@/lib/types";

export type StudioPreset = {
  id: string;
  name: string;
  description: string;
  modules: Module[];
  promptInjections: string[];
};

export const STUDIO_PRESETS_STORAGE_KEY = "magyc.studio.presets.v3";

export const HIDDEN_PRESET_TYPES = new Set<ModuleType>([
  "wikipedia",
  "gif",
  "icon",
  "ai_summary",
  "notes",
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
  },
];

export function createStudioPreset(): StudioPreset {
  return {
    id: `preset-${Date.now()}`,
    name: "Neues Preset",
    description: "",
    modules: [],
    promptInjections: [""],
  };
}

export function cleanStudioPresets(raw: unknown): StudioPreset[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed = raw
    .map((item) => {
      const candidate = item as Partial<StudioPreset>;
      const modules = Array.isArray(candidate.modules)
        ? candidate.modules.filter((module): module is Module =>
            !!module && typeof module === "object" && PRESET_ELEMENT_TYPE_SET.has((module as Module).type),
          )
        : [];
      if (!candidate.id || !candidate.name) return null;
      return {
        id: String(candidate.id),
        name: String(candidate.name),
        description: typeof candidate.description === "string" ? candidate.description : "",
        modules,
        promptInjections: Array.isArray(candidate.promptInjections)
          ? candidate.promptInjections.filter((prompt): prompt is string => typeof prompt === "string")
          : [""],
      };
    })
    .filter(Boolean) as StudioPreset[];
  return parsed;
}
