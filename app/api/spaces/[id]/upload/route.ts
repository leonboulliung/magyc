import { z } from "zod";
import { NextResponse } from "next/server";
import { newId } from "@/lib/id";
import { parseBody } from "@/lib/api/validate";
import {
  adminClientForUpload,
  ASSET_BUCKET,
  canAccessSpace,
  cleanFileName,
  extensionFromName,
  fetchSpaceForUpload,
  hydrateActorName,
  identifyUploadActor,
  isAssetPathForSpace,
  isMimeAllowed,
  MAX_UPLOAD_SIZE_BYTES,
  moduleExists,
  PROJECT_UPLOAD_QUOTA_BYTES,
  readSpaceUploadUsage,
  takePersistentRateLimit,
} from "@/lib/server/uploadSecurity";

/**
 * POST /api/spaces/[id]/upload
 *
 * Direct-upload protocol:
 *   1. { phase:"prepare", moduleIndex, name, size, mimeType, anonToken? }
 *      → validates access/quota and returns { path, token }.
 *   2. Browser uploads directly to Supabase Storage with uploadToSignedUrl.
 *   3. { phase:"complete", moduleIndex, path, name, size, mimeType, anonToken? }
 *      → validates again and records the upload as module_state.
 *
 * The file blob no longer travels through Vercel, so photographer media can
 * exceed the platform's small request-body ceiling. Reads are signed by the
 * sibling /assets/sign route; new state rows store the private Storage path.
 */

const bodySchema = z.object({
  phase: z.enum(["prepare", "complete"]),
  moduleIndex: z.number().int().min(0).max(64),
  name: z.string().min(1).max(220),
  size: z.number().int().min(1).max(MAX_UPLOAD_SIZE_BYTES),
  mimeType: z.string().min(1).max(160),
  path: z.string().max(400).optional(),
  anonToken: z.string().optional(),
  anonName: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  if (!isMimeAllowed(b.mimeType)) {
    return NextResponse.json({ error: "mime_not_allowed", type: b.mimeType }, { status: 415 });
  }

  const actorResult = await identifyUploadActor({ anonToken: b.anonToken, anonName: b.anonName });
  if (actorResult instanceof NextResponse) return actorResult;

  const admin = adminClientForUpload();
  const actor = await hydrateActorName(admin, actorResult);
  const rateKey = `upload:${params.id}:${actor.kind}:${actor.id}`;
  const allowed = await takePersistentRateLimit(admin, rateKey, 60, 90);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let space;
  try {
    space = await fetchSpaceForUpload(admin, params.id);
  } catch (error) {
    console.error("[upload] space fetch failed:", (error as Error).message);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!moduleExists(space, b.moduleIndex)) {
    return NextResponse.json({ error: "module_out_of_range" }, { status: 400 });
  }
  if (!canAccessSpace(space, actor)) {
    return NextResponse.json({ error: "not_shared" }, { status: 403 });
  }

  const usage = await readSpaceUploadUsage(admin, params.id);
  if (usage + b.size > PROJECT_UPLOAD_QUOTA_BYTES) {
    return NextResponse.json({ error: "storage_quota_exceeded" }, { status: 413 });
  }

  if (b.phase === "prepare") {
    const ext = extensionFromName(b.name);
    const safeName = cleanFileName(b.name.replace(/\.[^.]+$/, ""));
    const path = `${params.id}/${b.moduleIndex}/${newId()}-${safeName}.${ext}`;
    const { data, error } = await admin.storage
      .from(ASSET_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data?.token) {
      console.error("[upload] signed upload url failed:", error?.message);
      return NextResponse.json({ error: "storage_sign_failed" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      path: data.path || path,
      token: data.token,
      signedUrl: data.signedUrl,
      maxSize: MAX_UPLOAD_SIZE_BYTES,
    });
  }

  const path = b.path || "";
  if (!isAssetPathForSpace(params.id, path)) {
    return NextResponse.json({ error: "bad_asset_path" }, { status: 400 });
  }

  const { error: infoErr } = await admin.storage.from(ASSET_BUCKET).info(path);
  if (infoErr) {
    console.error("[upload] uploaded object missing:", infoErr.message);
    return NextResponse.json({ error: "storage_missing" }, { status: 400 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(path, 6 * 60 * 60);
  if (signErr) {
    console.error("[upload] read sign failed:", signErr.message);
    return NextResponse.json({ error: "storage_sign_failed" }, { status: 500 });
  }

  const { error: stateErr } = await admin.from("module_state").insert({
    id: newId(),
    space_id: params.id,
    module_index: b.moduleIndex,
    actor_kind: actor.kind,
    actor_id: actor.id,
    display_name: actor.displayName,
    kind: "upload",
    data: {
      path,
      name: b.name.slice(0, 200),
      size: b.size,
      mimeType: b.mimeType,
    },
  });
  if (stateErr) {
    console.error("[upload] state insert failed:", stateErr.message);
    const { error: removeErr } = await admin.storage.from(ASSET_BUCKET).remove([path]);
    if (removeErr) console.error("[upload] orphan cleanup failed:", removeErr.message);
    return NextResponse.json({ error: "upload_state_failed", detail: stateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    path,
    url: signed?.signedUrl || "",
    name: b.name,
    size: b.size,
    mimeType: b.mimeType,
  });
}
