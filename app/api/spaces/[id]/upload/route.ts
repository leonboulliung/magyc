import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { newId } from "@/lib/id";

/**
 * POST /api/spaces/[id]/upload
 *
 *   Multipart form body:
 *     file         — the file blob
 *     moduleIndex  — which widget this belongs to
 *     anonToken    — anon owner token (when not signed in)
 *     anonName     — optional display name
 *
 * Stores the file in the "space_assets" Supabase Storage bucket under
 * the path:  `{spaceId}/{moduleIndex}/{fileId}.{ext}`
 *
 * Returns { ok: true, url, name, size, mimeType } where `url` is the
 * public download URL. The caller then POSTs a `upload` state entry
 * via the /state endpoint — or this route can do that automatically
 * (the `autoState` query param enables it).
 *
 * Constraints:
 *   - Max file size: 50 MB
 *   - Allowed MIME types: images, audio, PDF, Office docs, text
 *   - Rate: token bucket per actor/space for reliable multi-file drops
 *
 * The "space_assets" bucket must be created in your Supabase project
 * with public access (or RLS policy matching your auth setup). If the
 * bucket doesn't exist, the upload will fail with a storage error that
 * surfaces as { error: "storage_failed" }.
 */

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "audio/",
  "video/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats",
  "application/vnd.oasis",
  "text/plain",
  "text/markdown",
  "text/csv",
];

function isMimeAllowed(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

// Token-bucket rate limit: a burst of BUCKET_CAP uploads is allowed (so
// dropping a dozen images at once works), refilling one token every REFILL_MS.
// This replaces the old hard one-per-2s gate that made multi-image uploads
// fail with "rate limited".
const BUCKET_CAP = 12;
const REFILL_MS = 1_500;
const buckets = new Map<string, { tokens: number; last: number }>();

function takeToken(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: BUCKET_CAP, last: now };
  b.tokens = Math.min(BUCKET_CAP, b.tokens + (now - b.last) / REFILL_MS);
  b.last = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const fileField = formData.get("file");
  if (!(fileField instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const moduleIndexRaw = formData.get("moduleIndex");
  const moduleIndex = moduleIndexRaw ? Number.parseInt(String(moduleIndexRaw), 10) : -1;
  if (!Number.isFinite(moduleIndex) || moduleIndex < 0 || moduleIndex > 64) {
    return NextResponse.json({ error: "bad_module_index" }, { status: 400 });
  }

  const file = fileField;
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  if (!isMimeAllowed(file.type)) {
    return NextResponse.json({ error: "mime_not_allowed", type: file.type }, { status: 415 });
  }

  // Identify actor.
  const { userId } = await auth();
  let actorId: string;
  let actorKind: "user" | "anon";
  let displayName: string | null = null;

  if (userId) {
    actorKind = "user";
    actorId = userId;
    const n = formData.get("anonName");
    displayName = n ? String(n).trim().slice(0, 40) : null;
  } else {
    const token = formData.get("anonToken");
    const tok = token ? String(token).trim() : "";
    if (tok.length < 16) {
      return NextResponse.json({ error: "anon_token_required" }, { status: 401 });
    }
    actorKind = "anon";
    actorId = tok.slice(0, 64);
    const n = formData.get("anonName");
    displayName = n ? String(n).trim().slice(0, 40) : null;
  }

  // Rate limit.
  const rateKey = `${actorId}:${params.id}`;
  if (!takeToken(rateKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const admin = supabaseAdmin();

  // Signed-in uploaders get their real name from their profile.
  if (actorKind === "user") {
    const { data: prof } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", actorId)
      .maybeSingle();
    const profName = typeof prof?.display_name === "string" ? prof.display_name.trim() : "";
    if (profName) displayName = profName.slice(0, 40);
  }

  // Verify space exists.
  const { data: space, error: spaceErr } = await admin
    .from("spaces")
    .select("id, anon_owner_token, modules, stage, shared, owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (spaceErr) {
    console.error("[upload] space fetch failed:", spaceErr.message);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!Array.isArray(space.modules) || moduleIndex >= space.modules.length) {
    return NextResponse.json({ error: "module_out_of_range" }, { status: 400 });
  }
  // Private suite project (stage set, not shared): only the owner may
  // upload. Once shared, anyone with the link can, as today.
  if (space.stage && !space.shared && (actorKind !== "user" || actorId !== space.owner_id)) {
    return NextResponse.json({ error: "not_shared" }, { status: 403 });
  }

  // Build storage path.
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.slice(0, 8) : "bin";
  const fileId = newId();
  const path = `${params.id}/${moduleIndex}/${fileId}.${ext}`;

  // Upload to Supabase Storage.
  const { error: storageErr } = await admin.storage
    .from("space_assets")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
  if (storageErr) {
    return NextResponse.json({ error: "storage_failed", detail: storageErr.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("space_assets").getPublicUrl(path);
  const url = urlData.publicUrl;

  // Write an `upload` state entry so all collaborators see the file.
  const { error: stateErr } = await admin.from("module_state").insert({
    id: newId(),
    space_id: params.id,
    module_index: moduleIndex,
    actor_kind: actorKind,
    actor_id: actorId,
    display_name: displayName,
    kind: "upload",
    data: {
      url,
      name: file.name.slice(0, 200),
      size: file.size,
      mimeType: file.type,
      path,
    },
  });
  if (stateErr) {
    console.error("[upload] state insert failed:", stateErr.message);
    const { error: removeErr } = await admin.storage.from("space_assets").remove([path]);
    if (removeErr) console.error("[upload] orphan cleanup failed:", removeErr.message);
    return NextResponse.json({ error: "upload_state_failed", detail: stateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url, name: file.name, size: file.size, mimeType: file.type });
}
