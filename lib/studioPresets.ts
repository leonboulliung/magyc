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
