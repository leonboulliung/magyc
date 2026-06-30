import { z } from "zod";
import { NextResponse } from "next/server";
import { newId } from "@/lib/id";
import { parseBody } from "@/lib/api/validate";
import { recordAppEvent } from "@/lib/server/observability";
import { hasStateCapacity } from "@/lib/server/stateLimits";
import {
  assertAssetExists,
  createAssetUploadUrl,
  removeAssetPaths,
  signAssetReadUrl,
  STORAGE_PROVIDER,
} from "@/lib/server/storage";
import {
  adminClientForUpload,
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
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  const startedAt = Date.now();
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
  const logEvent = (status: "ok" | "warn" | "error", error?: unknown, metadata?: Record<string, unknown>) =>
    recordAppEvent({
      eventType: `upload.${b.phase}`,
      status,
      route: "/api/spaces/[id]/upload",
      method: "POST",
      spaceId: params.id,
      userId: actor.userId,
      anonId: actor.kind === "anon" ? actor.id : null,
      actorKind: actor.kind,
      actorId: actor.id,
      latencyMs: Date.now() - startedAt,
      error,
      metadata: {
        provider: STORAGE_PROVIDER,
        moduleIndex: b.moduleIndex,
        size: b.size,
        mimeType: b.mimeType,
        phase: b.phase,
        ...metadata,
      },
    });
  const rateKey = `upload:${params.id}:${actor.kind}:${actor.id}`;
  const allowed = await takePersistentRateLimit(admin, rateKey, 60, 90);
  if (!allowed) {
    await logEvent("warn", "rate_limited");
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let space;
  try {
    space = await fetchSpaceForUpload(admin, params.id);
  } catch (error) {
    console.error("[upload] space fetch failed:", (error as Error).message);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!moduleExists(space, b.moduleIndex)) {
    await logEvent("warn", "module_out_of_range");
    return NextResponse.json({ error: "module_out_of_range" }, { status: 400 });
  }
  if (!await canAccessSpace(admin, space, actor)) {
    await logEvent("warn", "not_shared");
    return NextResponse.json({ error: "not_shared" }, { status: 403 });
  }

  try {
    const hasUploadCapacity = await hasStateCapacity(admin, params.id, b.moduleIndex, "upload");
    if (!hasUploadCapacity) {
      if (b.phase === "complete" && b.path && isAssetPathForSpace(params.id, b.path)) {
        await removeAssetPaths(admin, [b.path]).catch(() => {});
      }
      await logEvent("warn", "state_limit_reached");
      return NextResponse.json({ error: "state_limit_reached", kind: "upload", limit: 250 }, { status: 409 });
    }
  } catch (error) {
    console.error("[upload] capacity check failed:", (error as Error).message);
    await logEvent("error", error);
    return NextResponse.json({ error: "state_check_failed" }, { status: 500 });
  }

  const usage = await readSpaceUploadUsage(admin, params.id);
  if (usage + b.size > PROJECT_UPLOAD_QUOTA_BYTES) {
    await logEvent("warn", "storage_quota_exceeded", { usage });
    return NextResponse.json({ error: "storage_quota_exceeded" }, { status: 413 });
  }

  if (b.phase === "prepare") {
    const ext = extensionFromName(b.name);
    const safeName = cleanFileName(b.name.replace(/\.[^.]+$/, ""));
    const path = `${params.id}/${b.moduleIndex}/${newId()}-${safeName}.${ext}`;
    let signed;
    try {
      signed = await createAssetUploadUrl(admin, path);
    } catch (error) {
      console.error("[upload] signed upload url failed:", (error as Error).message);
      await logEvent("error", error, { path });
      return NextResponse.json({ error: "storage_sign_failed" }, { status: 500 });
    }
    await logEvent("ok", null, { path: signed.path });
    return NextResponse.json({
      ok: true,
      path: signed.path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      maxSize: MAX_UPLOAD_SIZE_BYTES,
    });
  }

  const path = b.path || "";
  if (!isAssetPathForSpace(params.id, path)) {
    await logEvent("warn", "bad_asset_path");
    return NextResponse.json({ error: "bad_asset_path" }, { status: 400 });
  }

  try {
    await assertAssetExists(admin, path);
  } catch (error) {
    console.error("[upload] uploaded object missing:", (error as Error).message);
    await logEvent("error", error, { path });
    return NextResponse.json({ error: "storage_missing" }, { status: 400 });
  }

  let signedUrl = "";
  try {
    signedUrl = await signAssetReadUrl(admin, path);
  } catch (error) {
    console.error("[upload] read sign failed:", (error as Error).message);
    await logEvent("error", error, { path });
    return NextResponse.json({ error: "storage_sign_failed" }, { status: 500 });
  }

  const stateId = newId();
  const createdAt = new Date();
  const stateData = {
    path,
    name: b.name.slice(0, 200),
    size: b.size,
    mimeType: b.mimeType,
  };
  const { error: stateErr } = await admin.from("module_state").insert({
    id: stateId,
    space_id: params.id,
    module_index: b.moduleIndex,
    actor_kind: actor.kind,
    actor_id: actor.id,
    display_name: actor.displayName,
    kind: "upload",
    data: stateData,
    created_at: createdAt.toISOString(),
  });
  if (stateErr) {
    console.error("[upload] state insert failed:", stateErr.message);
    await logEvent("error", stateErr.message, { path });
    try {
      await removeAssetPaths(admin, [path]);
    } catch (removeErr) {
      console.error("[upload] orphan cleanup failed:", (removeErr as Error).message);
      await logEvent("error", removeErr, { path, cleanup: true });
    }
    return NextResponse.json({ error: "upload_state_failed" }, { status: 500 });
  }

  await logEvent("ok", null, { path });
  return NextResponse.json({
    ok: true,
    path,
    url: signedUrl,
    name: b.name,
    size: b.size,
    mimeType: b.mimeType,
    entry: {
      id: stateId,
      moduleIndex: b.moduleIndex,
      kind: "upload",
      data: stateData,
      createdAt: createdAt.getTime(),
    },
  });
}
