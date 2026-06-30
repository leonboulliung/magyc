import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { ensureProfile } from "@/lib/server/profile";
import { cleanStudioPresets, type StudioPreset } from "@/lib/studioPresets";
import { presetAssetPaths } from "@/lib/presetState";
import { parseBody } from "@/lib/api/validate";
import { removeAssetPaths } from "@/lib/server/storage";
import { isAssetPathForPreset } from "@/lib/server/uploadSecurity";

type PresetRow = {
  id: string;
  owner_id?: string;
  name: string;
  description: string | null;
  modules: unknown[] | null;
  prompt_injections: unknown[] | null;
  allow_context_modules: boolean | null;
  template_state?: unknown[] | null;
  deleted_at?: string | null;
};

function mapRow(row: PresetRow): StudioPreset {
  const cleaned = cleanStudioPresets([{
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    modules: row.modules ?? [],
    templateState: row.template_state ?? [],
    promptInjections: row.prompt_injections ?? [],
    allowContextModules: row.allow_context_modules !== false,
  }]);
  return cleaned?.[0] ?? {
    id: row.id,
    name: row.name || "Preset",
    description: row.description ?? "",
    modules: [],
    templateState: [],
    promptInjections: [],
    allowContextModules: true,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const primary = await admin
    .from("studio_presets")
    .select("id, name, description, modules, template_state, prompt_injections, allow_context_modules, deleted_at")
    .eq("owner_id", userId)
    .order("position", { ascending: true });
  let data: PresetRow[] | null = primary.data as PresetRow[] | null;
  let error = primary.error;
  let retentionAvailable = true;
  if (error && error.code === "42703") {
    retentionAvailable = false;
    const fallback = await admin
      .from("studio_presets")
      .select("id, name, description, modules, template_state, prompt_injections, allow_context_modules")
      .eq("owner_id", userId)
      .order("position", { ascending: true });
    data = fallback.data as PresetRow[] | null;
    error = fallback.error;
  }
  if (error) {
    console.error("[studio-presets] fetch failed:", error.message);
    return NextResponse.json({ error: "presets_failed" }, { status: 500 });
  }

  const active = (data || []).filter((row) => !row.deleted_at).map(mapRow);
  const cutoff = Date.now() - 30 * 86_400_000;
  const deletedPresets = retentionAvailable
    ? (data || [])
        .filter((row) => row.deleted_at && new Date(row.deleted_at).getTime() >= cutoff)
        .map((row) => ({ ...mapRow(row), deletedAt: row.deleted_at }))
    : [];
  return NextResponse.json({ presets: active, deletedPresets, retentionAvailable });
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, z.object({
    presets: z.array(z.unknown()).max(50),
  }));
  if (!parsed.ok) return parsed.response;

  const presets = cleanStudioPresets(parsed.data.presets) ?? [];
  await ensureProfile(userId);

  const admin = supabaseAdmin();
  let existingRows: PresetRow[] = [];
  let templateStateAvailable = true;
  let retentionAvailable = true;
  const existingResult = await admin
    .from("studio_presets")
    .select("id, owner_id, name, description, modules, template_state, prompt_injections, allow_context_modules, deleted_at")
    .eq("owner_id", userId);
  if (existingResult.error?.code === "42703") {
    retentionAvailable = false;
    const fallback = await admin
      .from("studio_presets")
      .select("id, owner_id, name, description, modules, template_state, prompt_injections, allow_context_modules")
      .eq("owner_id", userId);
    if (fallback.error?.code === "42703") {
      templateStateAvailable = false;
      const legacy = await admin
        .from("studio_presets")
        .select("id, owner_id, name, description, modules, prompt_injections, allow_context_modules")
        .eq("owner_id", userId);
      if (legacy.error) {
        console.error("[studio-presets] existing fetch failed:", legacy.error.message);
        return NextResponse.json({ error: "presets_failed" }, { status: 500 });
      }
      existingRows = (legacy.data || []) as PresetRow[];
    } else if (fallback.error) {
      console.error("[studio-presets] existing fetch failed:", fallback.error.message);
      return NextResponse.json({ error: "presets_failed" }, { status: 500 });
    } else {
      existingRows = (fallback.data || []) as PresetRow[];
    }
  } else if (existingResult.error) {
    console.error("[studio-presets] existing fetch failed:", existingResult.error.message);
    return NextResponse.json({ error: "presets_failed" }, { status: 500 });
  } else {
    existingRows = (existingResult.data || []) as PresetRow[];
  }

  if (!templateStateAvailable && presets.some((preset) => preset.templateState.length > 0)) {
    return NextResponse.json({ error: "preset_state_migration_required" }, { status: 503 });
  }

  const rows = presets.map((preset, position) => ({
    id: preset.id,
    owner_id: userId,
    name: preset.name.slice(0, 120),
    description: preset.description.slice(0, 500),
    modules: preset.modules,
    ...(templateStateAvailable ? { template_state: preset.templateState } : {}),
    prompt_injections: preset.promptInjections.slice(0, 12),
    allow_context_modules: preset.allowContextModules !== false,
    position,
    updated_at: new Date().toISOString(),
    ...(retentionAvailable ? { deleted_at: null } : {}),
  }));

  if (rows.length > 0) {
    const { data: conflicting, error: conflictErr } = await admin
      .from("studio_presets")
      .select("id, owner_id")
      .in("id", rows.map((row) => row.id));
    if (conflictErr) {
      console.error("[studio-presets] conflict check failed:", conflictErr.message);
      return NextResponse.json({ error: "presets_failed" }, { status: 500 });
    }
    const blocked = (conflicting || []).some((row) => row.owner_id !== userId);
    if (blocked) {
      console.error("[studio-presets] id collision across owners");
      return NextResponse.json({ error: "presets_failed" }, { status: 409 });
    }

    const { data: saved, error: upsertErr } = await admin
      .from("studio_presets")
      .upsert(rows, { onConflict: "id" })
      .select("id");
    if (upsertErr) {
      console.error("[studio-presets] upsert failed:", upsertErr.message);
      return NextResponse.json({ error: "presets_failed" }, { status: 500 });
    }
    if (!saved || saved.length !== rows.length) {
      console.error("[studio-presets] upsert row mismatch:", saved?.length ?? 0, rows.length);
      return NextResponse.json({ error: "presets_failed" }, { status: 500 });
    }
  }

  const keepIds = rows.map((row) => row.id);
  const incomingPaths = new Set(presets.flatMap((preset) => presetAssetPaths(preset.templateState)));
  let staleQuery = retentionAvailable
    ? admin.from("studio_presets").update({ deleted_at: new Date().toISOString() }).eq("owner_id", userId).is("deleted_at", null)
    : admin.from("studio_presets").delete().eq("owner_id", userId);
  if (keepIds.length > 0) {
    const keepList = keepIds.map((id) => `"${id.replace(/"/g, "\"\"")}"`).join(",");
    staleQuery = staleQuery.not("id", "in", `(${keepList})`);
  }
  const { error: staleErr } = await staleQuery;
  if (staleErr) {
    console.error("[studio-presets] stale delete failed:", staleErr.message);
    return NextResponse.json({ error: "presets_failed" }, { status: 500 });
  }

  let purgePaths: string[] = [];
  if (retentionAvailable) {
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const expired = existingRows.filter((row) => row.deleted_at && row.deleted_at < cutoff);
    purgePaths = expired.flatMap((row) => presetAssetPaths(mapRow(row).templateState).filter((path) => isAssetPathForPreset(userId, row.id, path)));
    if (expired.length > 0) {
      const { error: purgeError } = await admin.from("studio_presets").delete().eq("owner_id", userId).lt("deleted_at", cutoff);
      if (purgeError) console.error("[studio-presets] expired purge failed:", purgeError.message);
    }
  } else {
    purgePaths = existingRows.flatMap((row) => presetAssetPaths(mapRow(row).templateState)
      .filter((path) => isAssetPathForPreset(userId, row.id, path) && !incomingPaths.has(path)));
  }

  if (purgePaths.length > 0) {
    try {
      await removeAssetPaths(admin, Array.from(new Set(purgePaths)));
    } catch (error) {
      console.error("[studio-presets] stale asset cleanup failed:", (error as Error).message);
    }
  }

  return NextResponse.json({ ok: true, presets, templateStateAvailable, retentionAvailable });
}
