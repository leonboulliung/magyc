import { z } from "zod";
import { NextResponse } from "next/server";
import { parseBody } from "@/lib/api/validate";
import {
  adminClientForUpload,
  ASSET_BUCKET,
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
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const actorResult = await identifyUploadActor({ anonToken: b.anonToken, anonName: b.anonName });
  if (actorResult instanceof NextResponse) return actorResult;

  const admin = adminClientForUpload();
  const actor = await hydrateActorName(admin, actorResult);
  const allowed = await takePersistentRateLimit(admin, `asset-sign:${params.id}:${actor.kind}:${actor.id}`, 60, 240);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let space;
  try {
    space = await fetchSpaceForUpload(admin, params.id);
  } catch (error) {
    console.error("[assets/sign] space fetch failed:", (error as Error).message);
    return NextResponse.json({ error: "asset_sign_failed" }, { status: 500 });
  }
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!canAccessSpace(space, actor)) return NextResponse.json({ error: "not_shared" }, { status: 403 });

  const paths = Array.from(new Set(b.paths.filter((path) => isAssetPathForSpace(params.id, path)))).slice(0, 80);
  if (paths.length === 0) return NextResponse.json({ error: "bad_asset_path" }, { status: 400 });

  const expiresIn = 6 * 60 * 60;
  const { data, error } = await admin.storage.from(ASSET_BUCKET).createSignedUrls(paths, expiresIn);
  if (error) {
    console.error("[assets/sign] signing failed:", error.message);
    return NextResponse.json({ error: "asset_sign_failed" }, { status: 500 });
  }

  const urls: Record<string, string> = {};
  for (const row of data || []) {
    if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
  }
  return NextResponse.json({ ok: true, urls, expiresIn });
}
