import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { cleanStudioPresets, type StudioPreset } from "@/lib/studioPresets";
import { parseBody } from "@/lib/api/validate";

type PresetRow = {
  id: string;
  name: string;
  description: string | null;
  modules: unknown[] | null;
  prompt_injections: unknown[] | null;
  allow_context_modules: boolean | null;
};

function mapRow(row: PresetRow): StudioPreset {
  const cleaned = cleanStudioPresets([{
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    modules: row.modules ?? [],
    promptInjections: row.prompt_injections ?? [],
    allowContextModules: row.allow_context_modules !== false,
  }]);
  return cleaned?.[0] ?? {
    id: row.id,
    name: row.name || "Preset",
    description: row.description ?? "",
    modules: [],
    promptInjections: [],
    allowContextModules: true,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("studio_presets")
    .select("id, name, description, modules, prompt_injections, allow_context_modules")
    .eq("owner_id", userId)
    .order("position", { ascending: true });
  if (error) {
    console.error("[studio-presets] fetch failed:", error.message);
    return NextResponse.json({ error: "presets_failed" }, { status: 500 });
  }

  return NextResponse.json({ presets: ((data || []) as PresetRow[]).map(mapRow) });
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
  const rows = presets.map((preset, position) => ({
    id: preset.id,
    owner_id: userId,
    name: preset.name.slice(0, 120),
    description: preset.description.slice(0, 500),
    modules: preset.modules,
    prompt_injections: preset.promptInjections.slice(0, 12),
    allow_context_modules: preset.allowContextModules !== false,
    position,
    updated_at: new Date().toISOString(),
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
  let staleQuery = admin.from("studio_presets").delete().eq("owner_id", userId);
  if (keepIds.length > 0) {
    const keepList = keepIds.map((id) => `"${id.replace(/"/g, "\"\"")}"`).join(",");
    staleQuery = staleQuery.not("id", "in", `(${keepList})`);
  }
  const { error: staleErr } = await staleQuery;
  if (staleErr) {
    console.error("[studio-presets] stale delete failed:", staleErr.message);
    return NextResponse.json({ error: "presets_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, presets });
}
