import type { SupabaseClient } from "@supabase/supabase-js";
import { newId } from "@/lib/id";
import { cleanPresetState } from "@/lib/presetState";
import { cleanStudioPresets, type StudioPreset } from "@/lib/studioPresets";
import { copyAssetPath, removeAssetPaths } from "@/lib/server/storage";
import { cleanFileName, extensionFromName, isAssetPathForPreset } from "@/lib/server/uploadSecurity";
import type { Module } from "@/lib/types";

type PresetRow = {
  id: string;
  name: string;
  description: string | null;
  modules: unknown[] | null;
  template_state?: unknown[] | null;
  prompt_injections: unknown[] | null;
  allow_context_modules: boolean | null;
};

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let failure: unknown = null;
  async function worker() {
    while (!failure) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = await task(items[index], index);
      } catch (error) {
        failure = error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  if (failure) throw failure;
  return results;
}

export async function fetchOwnedPreset(
  admin: SupabaseClient,
  ownerId: string,
  presetId: string,
): Promise<StudioPreset | null> {
  if (!presetId) return null;
  const primary = await admin
    .from("studio_presets")
    .select("id, name, description, modules, template_state, prompt_injections, allow_context_modules")
    .eq("id", presetId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  let data: PresetRow | null = primary.data as PresetRow | null;
  let error = primary.error;
  if (error?.code === "42703") {
    const fallback = await admin
      .from("studio_presets")
      .select("id, name, description, modules, prompt_injections, allow_context_modules")
      .eq("id", presetId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    data = fallback.data as PresetRow | null;
    error = fallback.error;
  }
  if (error) throw error;
  if (!data) return null;
  return cleanStudioPresets([{
    id: data.id,
    name: data.name,
    description: data.description ?? "",
    modules: data.modules ?? [],
    templateState: data.template_state ?? [],
    promptInjections: data.prompt_injections ?? [],
    allowContextModules: data.allow_context_modules !== false,
  }])?.[0] ?? null;
}

function remapReferences(data: Record<string, unknown>, ids: Map<string, string>): Record<string, unknown> {
  const next = { ...data };
  for (const key of ["id", "itemKey", "parentId"] as const) {
    const value = next[key];
    if (typeof value === "string" && ids.has(value)) next[key] = ids.get(value)!;
  }
  return next;
}

export async function materializePresetState(input: {
  admin: SupabaseClient;
  preset: StudioPreset;
  projectId: string;
  projectModules: Module[];
  ownerId: string;
}): Promise<number> {
  const { admin, preset, projectId, projectModules, ownerId } = input;
  const entries = cleanPresetState(preset.templateState, preset.modules.length);
  if (!entries.length) return 0;

  const indexMap = new Map<number, number>();
  preset.modules.forEach((module, presetIndex) => {
    const projectIndex = projectModules.findIndex((candidate) => candidate.type === module.type);
    if (projectIndex >= 0) indexMap.set(presetIndex, projectIndex);
  });
  const applicable = entries.filter((entry) => indexMap.has(entry.moduleIndex));
  if (!applicable.length) return 0;

  const idMap = new Map(applicable.map((entry) => [entry.id, newId()]));
  const copiedPaths: string[] = [];

  try {
    const prepared = await mapConcurrent(applicable, 4, async (entry, position) => {
      const moduleIndex = indexMap.get(entry.moduleIndex)!;
      let data = remapReferences(entry.data, idMap);
      if (entry.kind === "upload" && typeof data.path === "string") {
        if (!isAssetPathForPreset(ownerId, preset.id, data.path)) {
          throw new Error("preset_asset_path_invalid");
        }
        const name = typeof data.name === "string" ? data.name : "datei";
        const extension = extensionFromName(name || data.path);
        const baseName = cleanFileName(name.replace(/\.[^.]+$/, ""));
        const destination = `${projectId}/${moduleIndex}/${newId()}-${baseName}.${extension}`;
        await copyAssetPath(admin, data.path, destination);
        copiedPaths.push(destination);
        data = { ...data, path: destination };
        delete data.url;
      }
      return {
        id: idMap.get(entry.id)!,
        space_id: projectId,
        module_index: moduleIndex,
        actor_kind: "user",
        actor_id: ownerId,
        display_name: null,
        kind: entry.kind,
        data,
        created_at: new Date(Date.now() + position).toISOString(),
      };
    });

    const { error } = await admin.from("module_state").insert(prepared);
    if (error) throw error;
    return prepared.length;
  } catch (error) {
    try { await removeAssetPaths(admin, copiedPaths); } catch { /* best effort rollback */ }
    throw error;
  }
}
