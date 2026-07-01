import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/validate";
import { newId } from "@/lib/id";
import { cleanPresetState, type PresetStateEntry } from "@/lib/presetState";
import {
  assertAssetExists,
  createAssetUploadUrl,
  removeAssetPaths,
  signAssetReadUrl,
} from "@/lib/server/storage";
import {
  cleanFileName,
  extensionFromName,
  isAssetPathForPreset,
  isMimeAllowed,
  isMimeAllowedForModule,
  MAX_UPLOAD_SIZE_BYTES,
  presetAssetPrefix,
  PROJECT_UPLOAD_QUOTA_BYTES,
  takePersistentRateLimit,
} from "@/lib/server/uploadSecurity";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

const bodySchema = z.object({
  phase: z.enum(["prepare", "complete"]),
  moduleIndex: z.number().int().min(0).max(64),
  name: z.string().min(1).max(220),
  size: z.number().int().min(1).max(MAX_UPLOAD_SIZE_BYTES),
  mimeType: z.string().min(1).max(160),
  path: z.string().max(400).optional(),
});

type PresetRow = {
  id: string;
  owner_id: string;
  modules: unknown[] | null;
  template_state: unknown[] | null;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (!isMimeAllowed(body.mimeType)) {
    return NextResponse.json({ error: "mime_not_allowed", type: body.mimeType }, { status: 415 });
  }

  const admin = supabaseAdmin();
  const allowed = await takePersistentRateLimit(admin, `preset-upload:${userId}:${id}`, 60, 90);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { data, error } = await admin
    .from("studio_presets")
    .select("id, owner_id, modules, template_state")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error?.code === "42703") {
    return NextResponse.json({ error: "preset_state_migration_required" }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: "presets_failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "preset_not_saved" }, { status: 409 });
  const preset = data as PresetRow;
  const moduleCount = Array.isArray(preset.modules) ? preset.modules.length : 0;
  if (body.moduleIndex >= moduleCount) {
    return NextResponse.json({ error: "module_out_of_range" }, { status: 400 });
  }
  const module = Array.isArray(preset.modules) ? preset.modules[body.moduleIndex] : null;
  const moduleType = module && typeof module === "object" ? (module as { type?: unknown }).type : null;
  if (!isMimeAllowedForModule(moduleType, body.mimeType)) {
    return NextResponse.json({ error: "mime_not_allowed_for_module" }, { status: 415 });
  }
  const templateState = cleanPresetState(preset.template_state, moduleCount);
  const usage = templateState.reduce((sum, entry) => (
    entry.kind === "upload" && typeof entry.data.size === "number" ? sum + entry.data.size : sum
  ), 0);
  if (usage + body.size > PROJECT_UPLOAD_QUOTA_BYTES) {
    return NextResponse.json({ error: "storage_quota_exceeded" }, { status: 413 });
  }

  if (body.phase === "prepare") {
    const ext = extensionFromName(body.name);
    const baseName = cleanFileName(body.name.replace(/\.[^.]+$/, ""));
    const path = `${presetAssetPrefix(userId, id)}/${body.moduleIndex}/${newId()}-${baseName}.${ext}`;
    try {
      const signed = await createAssetUploadUrl(admin, path);
      return NextResponse.json({ ok: true, ...signed, maxSize: MAX_UPLOAD_SIZE_BYTES });
    } catch (uploadError) {
      console.error("[preset-upload] prepare failed:", (uploadError as Error).message);
      return NextResponse.json({ error: "storage_sign_failed" }, { status: 500 });
    }
  }

  const path = body.path || "";
  if (!isAssetPathForPreset(userId, id, path)) {
    return NextResponse.json({ error: "bad_asset_path" }, { status: 400 });
  }
  try {
    await assertAssetExists(admin, path);
  } catch {
    return NextResponse.json({ error: "storage_missing" }, { status: 400 });
  }

  const entry: PresetStateEntry = {
    id: newId(),
    moduleIndex: body.moduleIndex,
    kind: "upload",
    data: {
      path,
      name: body.name.slice(0, 200),
      size: body.size,
      mimeType: body.mimeType,
    },
    createdAt: Date.now(),
  };
  const nextState = cleanPresetState([...templateState, entry], moduleCount);
  const { data: saved, error: saveError } = await admin
    .from("studio_presets")
    .update({ template_state: nextState, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", userId)
    .select("id");
  if (saveError || !saved?.length) {
    try { await removeAssetPaths(admin, [path]); } catch { /* best effort */ }
    return NextResponse.json({ error: "upload_state_failed" }, { status: 500 });
  }

  try {
    const url = await signAssetReadUrl(admin, path);
    return NextResponse.json({
      ok: true,
      path,
      url,
      name: body.name,
      size: body.size,
      mimeType: body.mimeType,
      entry,
    });
  } catch {
    return NextResponse.json({ error: "storage_sign_failed" }, { status: 500 });
  }
}
