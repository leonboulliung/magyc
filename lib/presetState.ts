import { newLocalId } from "@/lib/id";
import { singleActiveRule, scopeValue } from "@/lib/stateDedup";
import type { ModuleStateEntry, ModuleStateKind } from "@/lib/types";

export type PresetStateEntry = Pick<
  ModuleStateEntry,
  "id" | "moduleIndex" | "kind" | "data" | "createdAt"
>;

const ALLOWED_KINDS = new Set<ModuleStateKind>([
  "vote",
  "check",
  "claim",
  "voice",
  "edit",
  "add",
  "upload",
  "stroke",
]);

function cleanData(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  try {
    const serialized = JSON.stringify(raw);
    if (serialized.length > 16_000) return null;
    return JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function cleanPresetState(raw: unknown, moduleCount: number): PresetStateEntry[] {
  if (!Array.isArray(raw) || moduleCount <= 0) return [];
  const ids = new Set<string>();
  const entries: PresetStateEntry[] = [];

  for (const candidate of raw.slice(0, 500)) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Partial<PresetStateEntry>;
    const moduleIndex = typeof row.moduleIndex === "number" ? Math.floor(row.moduleIndex) : -1;
    if (moduleIndex < 0 || moduleIndex >= moduleCount) continue;
    if (typeof row.kind !== "string" || !ALLOWED_KINDS.has(row.kind as ModuleStateKind)) continue;
    const data = cleanData(row.data);
    if (!data) continue;
    const rawId = typeof row.id === "string" ? row.id.trim().slice(0, 120) : "";
    const id = rawId && !ids.has(rawId) ? rawId : newLocalId("preset");
    ids.add(id);
    entries.push({
      id,
      moduleIndex,
      kind: row.kind as ModuleStateKind,
      data,
      createdAt: typeof row.createdAt === "number" && Number.isFinite(row.createdAt)
        ? Math.max(0, Math.floor(row.createdAt))
        : Date.now() + entries.length,
    });
  }

  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

export function presetStateForPreview(
  presetId: string,
  entries: PresetStateEntry[],
  moduleIndex: number,
): ModuleStateEntry[] {
  return entries
    .filter((entry) => entry.moduleIndex === moduleIndex)
    .map((entry) => ({
      ...entry,
      spaceId: `preset:${presetId}`,
      actor: { kind: "user" as const, id: "preset-owner", displayName: "Preset" },
    }));
}

export function applyPresetStateAction(
  entries: PresetStateEntry[],
  moduleIndex: number,
  kind: ModuleStateKind,
  data: Record<string, unknown>,
): PresetStateEntry[] {
  if (kind === "edit" && data.deleted === true && typeof data.id === "string" && !data.id.startsWith("seed-")) {
    const target = data.id;
    return entries.filter((current) => {
      if (current.id === target || current.data.id === target) return false;
      if (current.data.id === target || current.data.parentId === target || current.data.itemKey === target) return false;
      return true;
    });
  }
  const entry: PresetStateEntry = {
    id: newLocalId("preset"),
    moduleIndex,
    kind,
    data,
    createdAt: Date.now(),
  };
  const rule = singleActiveRule(kind);
  if (!rule) return [...entries, entry];

  const scoped = scopeValue(rule, data);
  const field = rule.scopeField;
  const next = entries.filter((current) => !(
    current.moduleIndex === moduleIndex &&
    current.kind === kind &&
    (field ? current.data[field] === scoped : true)
  ));
  return rule.isRetraction(data) ? next : [...next, entry];
}

export function removePresetModuleState(
  entries: PresetStateEntry[],
  removedIndex: number,
): PresetStateEntry[] {
  return entries
    .filter((entry) => entry.moduleIndex !== removedIndex)
    .map((entry) => entry.moduleIndex > removedIndex
      ? { ...entry, moduleIndex: entry.moduleIndex - 1 }
      : entry);
}

export function presetAssetPaths(entries: PresetStateEntry[]): string[] {
  return Array.from(new Set(entries
    .filter((entry) => entry.kind === "upload")
    .map((entry) => typeof entry.data.path === "string" ? entry.data.path : "")
    .filter(Boolean)));
}
