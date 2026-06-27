import { z } from "zod";
import { NextResponse } from "next/server";
import { parseBody } from "@/lib/api/validate";
import { recordAppEvent } from "@/lib/server/observability";
import { signAssetReadUrls, SIGNED_READ_EXPIRES_SECONDS, STORAGE_PROVIDER } from "@/lib/server/storage";
import {
  adminClientForUpload,
  canAccessSpace,
  fetchSpaceForUpload,
  hydrateActorName,
  identifyUploadActor,
  isAssetPathForSpace,
  takePersistentRateLimit,
} from "@/lib/server/uploadSecurity";

const bodySchema = z.object({
  paths: z.array(z.string().min(1).max(400)).min(1).max(80),
  anonToken: z.string().optional(),
  anonName: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const startedAt = Date.now();
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const actorResult = await identifyUploadActor({ anonToken: b.anonToken, anonName: b.anonName });
  if (actorResult instanceof NextResponse) return actorResult;

  const admin = adminClientForUpload();
  const actor = await hydrateActorName(admin, actorResult);
  const logEvent = (status: "ok" | "warn" | "error", error?: unknown, metadata?: Record<string, unknown>) =>
    recordAppEvent({
      eventType: "asset.sign",
      status,
      route: "/api/spaces/[id]/assets/sign",
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
        requested: b.paths.length,
        ...metadata,
      },
    });
  const allowed = await takePersistentRateLimit(admin, `asset-sign:${params.id}:${actor.kind}:${actor.id}`, 60, 240);
  if (!allowed) {
    await logEvent("warn", "rate_limited");
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let space;
  try {
    space = await fetchSpaceForUpload(admin, params.id);
  } catch (error) {
    console.error("[assets/sign] space fetch failed:", (error as Error).message);
    return NextResponse.json({ error: "asset_sign_failed" }, { status: 500 });
  }
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await canAccessSpace(admin, space, actor)) {
    await logEvent("warn", "not_shared");
    return NextResponse.json({ error: "not_shared" }, { status: 403 });
  }

  const paths = Array.from(new Set(b.paths.filter((path) => isAssetPathForSpace(params.id, path)))).slice(0, 80);
  if (paths.length === 0) {
    await logEvent("warn", "bad_asset_path");
    return NextResponse.json({ error: "bad_asset_path" }, { status: 400 });
  }

  const expiresIn = SIGNED_READ_EXPIRES_SECONDS;
  let urls: Record<string, string>;
  try {
    urls = await signAssetReadUrls(admin, paths, expiresIn);
  } catch (error) {
    console.error("[assets/sign] signing failed:", (error as Error).message);
    await logEvent("error", error, { validPaths: paths.length });
    return NextResponse.json({ error: "asset_sign_failed" }, { status: 500 });
  }

  await logEvent("ok", null, { validPaths: paths.length, signed: Object.keys(urls).length, expiresIn });
  return NextResponse.json({ ok: true, urls, expiresIn });
}
