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
  const { error: deleteErr } = await admin
    .from("studio_presets")
    .delete()
    .eq("owner_id", userId);
  if (deleteErr) {
    console.error("[studio-presets] delete failed:", deleteErr.message);
    return NextResponse.json({ error: "presets_failed" }, { status: 500 });
  }

  if (presets.length > 0) {
    const { error: insertErr } = await admin.from("studio_presets").insert(
      presets.map((preset, position) => ({
        id: preset.id,
        owner_id: userId,
        name: preset.name.slice(0, 120),
        description: preset.description.slice(0, 500),
        modules: preset.modules,
        prompt_injections: preset.promptInjections.slice(0, 12),
        allow_context_modules: preset.allowContextModules !== false,
        position,
        updated_at: new Date().toISOString(),
      })),
    );
    if (insertErr) {
      console.error("[studio-presets] insert failed:", insertErr.message);
      return NextResponse.json({ error: "presets_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, presets });
}
