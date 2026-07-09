import { bodyTypes, sanitizeModule } from "@/lib/modules";
import { cleanPresetState, type PresetStateEntry } from "@/lib/presetState";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { Module, ModuleType } from "@/lib/types";

export type StudioPreset = {
  id: string;
  name: string;
  description: string;
  modules: Module[];
  templateState: PresetStateEntry[];
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
  "range",
  "selection",
  "location_single",
  "route",
]);

export const PRESET_ELEMENT_TYPES = bodyTypes().filter((type) => !HIDDEN_PRESET_TYPES.has(type));
export const PRESET_ELEMENT_TYPE_SET = new Set(PRESET_ELEMENT_TYPES);

type LocalizedPresetModule = {
  title: string;
  directions?: string[];
  shots?: string[];
  purpose?: string[];
  columns?: string[];
  rows?: string[];
  items?: string[];
  formats?: string[];
  roles?: string[];
  text?: string;
  dueSoon?: string;
};

type LocalizedPresetModules = Record<string, LocalizedPresetModule>;

function productDefaults(t: Dictionary["presets"]["defaults"]["defaultStudio"][number]): StudioPreset {
  const modules = t.modules as unknown as LocalizedPresetModules;
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    modules: [
      { type: "moodboard", microTitle: modules.moodboard.title, directions: (modules.moodboard.directions ?? []).map((label) => ({ label })) },
      { type: "shot_list", microTitle: modules.shotList.title, shots: [
        { label: modules.shotList.shots?.[0] ?? "", priority: "must", status: "planned" },
        { label: modules.shotList.shots?.[1] ?? "", priority: "should", status: "planned" },
      ] },
      { type: "table", microTitle: modules.table.title, columns: modules.table.columns ?? [], rows: (modules.table.rows ?? []).map((row) => [row, ""]) },
      { type: "deliverables", microTitle: modules.deliverables.title, items: (modules.deliverables.items ?? []).map((label) => ({ label })) },
      { type: "approvals", microTitle: modules.approvals.title, items: (modules.approvals.items ?? []).map((text) => ({ text })) },
    ],
    templateState: [],
    promptInjections: [t.prompt],
    allowContextModules: true,
  };
}

function weddingDefaults(t: Dictionary["presets"]["defaults"]["defaultStudio"][number]): StudioPreset {
  const modules = t.modules as unknown as LocalizedPresetModules;
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    modules: [
      { type: "shot_list", microTitle: modules.shotList.title, shots: (modules.shotList.shots ?? []).map((label) => ({ label, priority: "must", status: "planned" })) },
      { type: "locations_multi", microTitle: modules.places.title, locations: [
        { lng: 13.4049, lat: 52.52, label: modules.places.items?.[0] ?? "" },
        { lng: 13.3903, lat: 52.5076, label: modules.places.items?.[1] ?? "" },
      ] },
      { type: "appointment", microTitle: modules.appointment.title, datetime: new Date().toISOString() },
      { type: "checklist", microTitle: modules.checklist.title, items: (modules.checklist.items ?? []).map((text) => ({ text })) },
      { type: "deliverables", microTitle: modules.deliverables.title, items: (modules.deliverables.items ?? []).map((label) => ({ label })) },
    ],
    templateState: [],
    promptInjections: [t.prompt],
    allowContextModules: true,
  };
}

export function defaultStudioPresetsFor(t: Dictionary): StudioPreset[] {
  const [product, wedding] = t.presets.defaults.defaultStudio;
  return [productDefaults(product), weddingDefaults(wedding)];
}

export function marketingStarterPresetsFor(t: Dictionary): StudioPreset[] {
  return t.presets.defaults.marketing.map((preset) => {
    const modules = preset.modules as unknown as LocalizedPresetModules;
    if (preset.id === "starter-product") {
      return {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        modules: [
          { type: "moodboard", microTitle: modules.moodboard.title, directions: (modules.moodboard.directions ?? []).map((label, index) => ({ label, status: index === 2 ? "avoid" : "reference" })) },
          { type: "shot_list", microTitle: modules.shotList.title, shots: (modules.shotList.shots ?? []).map((label, index) => ({ label, purpose: modules.shotList.purpose?.[index] ?? "", priority: index === 0 ? "must" : "should", status: "planned" })) },
          { type: "table", microTitle: modules.table.title, columns: modules.table.columns ?? [], rows: (modules.table.rows ?? []).map((row) => [row, ""]) },
          { type: "deliverables", microTitle: modules.deliverables.title, items: (modules.deliverables.items ?? []).map((label, index) => ({ label, format: modules.deliverables.formats?.[index] ?? "", status: "planned" })) },
          { type: "approvals", microTitle: modules.approvals.title, items: (modules.approvals.items ?? []).map((text) => ({ text, audience: "client", status: "pending" })) },
          { type: "checklist", microTitle: modules.checklist.title, items: (modules.checklist.items ?? []).map((text) => ({ text })) },
        ],
        templateState: [],
        promptInjections: [preset.prompt],
        allowContextModules: true,
      };
    }
    if (preset.id === "starter-wedding") {
      return {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        modules: [
          { type: "appointments", microTitle: modules.appointments.title, entries: [] },
          { type: "locations_multi", microTitle: modules.places.title, locations: [] },
          { type: "shot_list", microTitle: modules.shotList.title, shots: (modules.shotList.shots ?? []).map((label) => ({ label, priority: "must", status: "planned" })) },
          { type: "crew", microTitle: modules.crew.title, roles: (modules.crew.roles ?? []).map((name) => ({ name })) },
          { type: "deliverables", microTitle: modules.deliverables.title, items: (modules.deliverables.items ?? []).map((label) => ({ label, status: "planned" })) },
          { type: "checklist", microTitle: modules.checklist.title, items: (modules.checklist.items ?? []).map((text) => ({ text })) },
        ],
        templateState: [],
        promptInjections: [preset.prompt],
        allowContextModules: true,
      };
    }
    if (preset.id === "starter-business-portrait") {
      return {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        modules: [
          { type: "rich_text", microTitle: modules.richText.title, text: modules.richText.text ?? "" },
          { type: "moodboard", microTitle: modules.moodboard.title, directions: (modules.moodboard.directions ?? []).map((label) => ({ label, status: "reference" })) },
          { type: "locations_multi", microTitle: modules.places.title, locations: [] },
          { type: "parts_list", microTitle: modules.parts.title, items: (modules.parts.items ?? []).map((name) => ({ name })) },
          { type: "shot_list", microTitle: modules.shotList.title, shots: (modules.shotList.shots ?? []).map((label, index) => ({ label, purpose: modules.shotList.purpose?.[index] ?? "", priority: index === 0 ? "must" : index === 1 ? "should" : "nice", status: "planned" })) },
          { type: "deliverables", microTitle: modules.deliverables.title, items: (modules.deliverables.items ?? []).map((label, index) => ({ label, format: modules.deliverables.formats?.[index] ?? "", status: "planned" })) },
        ],
        templateState: [],
        promptInjections: [preset.prompt],
        allowContextModules: true,
      };
    }
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      modules: [
        { type: "appointments", microTitle: modules.appointments.title, entries: [] },
        { type: "locations_multi", microTitle: modules.places.title, locations: [] },
        { type: "crew", microTitle: modules.crew.title, roles: (modules.crew.roles ?? []).map((name) => ({ name })) },
        { type: "shot_list", microTitle: modules.shotList.title, shots: (modules.shotList.shots ?? []).map((label, index) => ({ label, priority: index < 2 ? "must" : "should", status: "planned" })) },
        { type: "table", microTitle: modules.table.title, columns: modules.table.columns ?? [], rows: (modules.table.rows ?? []).map((row) => [row, ""]) },
        { type: "deliverables", microTitle: modules.deliverables.title, items: (modules.deliverables.items ?? []).map((label, index) => ({ label, due: index === 0 ? modules.deliverables.dueSoon : undefined, status: "planned" })) },
      ],
      templateState: [],
      promptInjections: [preset.prompt],
      allowContextModules: true,
    };
  });
}

export const DEFAULT_STUDIO_PRESETS: StudioPreset[] = defaultStudioPresetsFor(getDictionary("de"));
export const MARKETING_STARTER_PRESETS: StudioPreset[] = marketingStarterPresetsFor(getDictionary("de"));

export function createStudioPreset(): StudioPreset {
  return {
    id: `preset-${Date.now()}`,
    name: "",
    description: "",
    modules: [],
    templateState: [],
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

/** Fold historic single-place and route presets into the canonical places module. */
function canonicalPresetModule(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const module = raw as Record<string, unknown>;
  if (module.type === "location_single") {
    const center = Array.isArray(module.center) ? module.center : [];
    return {
      ...module,
      type: "locations_multi",
      microTitle: module.microTitle || getDictionary("de").presets.labels.locations_multi,
      locations: center.length === 2 ? [{ lng: center[0], lat: center[1], label: module.label }] : [],
    };
  }
  if (module.type === "route") {
    return {
      ...module,
      type: "locations_multi",
      microTitle: module.microTitle || getDictionary("de").presets.labels.locations_multi,
      locations: Array.isArray(module.stops) ? module.stops : [],
    };
  }
  return raw;
}

export function cleanStudioPresets(raw: unknown): StudioPreset[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed = raw
    .map((item, index) => {
      const candidate = item as Partial<StudioPreset>;
      const rawModules = Array.isArray(candidate.modules)
        ? candidate.modules
            .map(canonicalPresetModule)
            .map(sanitizeModule)
            .filter((module): module is Module => !!module && PRESET_ELEMENT_TYPE_SET.has(module.type))
        : [];
      const moduleIndexMap = new Map<number, number>();
      const modules: Module[] = [];
      rawModules.forEach((module, rawIndex) => {
        const existingIndex = modules.findIndex((current) => current.type === module.type);
        if (existingIndex >= 0) {
          const existing = modules[existingIndex];
          if (existing.type === "locations_multi" && module.type === "locations_multi") {
            modules[existingIndex] = {
              ...existing,
              locations: [...existing.locations, ...module.locations].slice(0, 24),
            };
          }
          moduleIndexMap.set(rawIndex, existingIndex);
          return;
        }
        moduleIndexMap.set(rawIndex, modules.length);
        modules.push(module);
      });
      const templateState = cleanPresetState(candidate.templateState, rawModules.length)
        .map((entry) => {
          const moduleIndex = moduleIndexMap.get(entry.moduleIndex);
          return moduleIndex === undefined ? null : { ...entry, moduleIndex };
        })
        .filter((entry): entry is NonNullable<typeof entry> => !!entry);
      const id = cleanPresetId(candidate.id, index);
      const name = typeof candidate.name === "string"
        ? candidate.name.replace(/\s+/g, " ").trim().slice(0, 120)
        : "";
      return {
        id,
        name: name || getDictionary("de").presets.unnamed,
        description: typeof candidate.description === "string" ? candidate.description.slice(0, 500) : "",
        modules,
        templateState: cleanPresetState(templateState, modules.length),
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
