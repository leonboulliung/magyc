import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/validate";
import { signAssetReadUrls, SIGNED_READ_EXPIRES_SECONDS } from "@/lib/server/storage";
import { isAssetPathForPreset, takePersistentRateLimit } from "@/lib/server/uploadSecurity";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

const bodySchema = z.object({
  paths: z.array(z.string().min(1).max(400)).min(1).max(80),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const admin = supabaseAdmin();
  const allowed = await takePersistentRateLimit(admin, `preset-sign:${userId}:${id}`, 60, 240);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const { data: preset, error } = await admin
    .from("studio_presets")
    .select("id")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "asset_sign_failed" }, { status: 500 });
  if (!preset) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const paths = Array.from(new Set(parsed.data.paths.filter((path) => (
    isAssetPathForPreset(userId, id, path)
  ))));
  if (!paths.length) return NextResponse.json({ error: "bad_asset_path" }, { status: 400 });
  try {
    const urls = await signAssetReadUrls(admin, paths, SIGNED_READ_EXPIRES_SECONDS);
    return NextResponse.json({ ok: true, urls, expiresIn: SIGNED_READ_EXPIRES_SECONDS });
  } catch (signError) {
    console.error("[preset-assets] signing failed:", (signError as Error).message);
    return NextResponse.json({ error: "asset_sign_failed" }, { status: 500 });
  }
}
