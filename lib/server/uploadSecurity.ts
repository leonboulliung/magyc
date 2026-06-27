import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectAccess } from "@/lib/server/projectAccess";

export const ASSET_BUCKET = "space_assets";
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
export const PROJECT_UPLOAD_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "audio/",
  "video/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats",
  "application/vnd.oasis",
  "text/plain",
  "text/markdown",
  "text/csv",
];

export function isMimeAllowed(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

export interface UploadActor {
  kind: "user" | "anon";
  id: string;
  displayName: string | null;
  userId: string | null;
}

export interface SpaceForUpload {
  id: string;
  modules: unknown[] | null;
  stage: string | null;
  shared: boolean | null;
  owner_id: string | null;
}

export function cleanFileName(name: string): string {
  return name.replace(/[^\w.\- äöüÄÖÜß]/g, "_").replace(/\s+/g, "_").slice(0, 160) || "datei";
}

export function extensionFromName(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  return ext || "bin";
}

export function isAssetPathForSpace(spaceId: string, path: string): boolean {
  return path.startsWith(`${spaceId}/`) && !path.includes("..") && !path.startsWith("/") && path.length <= 400;
}

function storageSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

export function presetAssetPrefix(ownerId: string, presetId: string): string {
  return `presets/${storageSegment(ownerId)}/${storageSegment(presetId)}`;
}

export function isAssetPathForPreset(ownerId: string, presetId: string, path: string): boolean {
  const prefix = `${presetAssetPrefix(ownerId, presetId)}/`;
  return path.startsWith(prefix) && !path.includes("..") && !path.startsWith("/") && path.length <= 400;
}

export async function identifyUploadActor(input: {
  anonToken?: unknown;
  anonName?: unknown;
}): Promise<UploadActor | NextResponse> {
  const { userId } = await auth();
  let actor: UploadActor;
  if (userId) {
    actor = {
      kind: "user",
      id: userId,
      userId,
      displayName: typeof input.anonName === "string" ? input.anonName.trim().slice(0, 40) || null : null,
    };
  } else {
    const token = typeof input.anonToken === "string" ? input.anonToken.trim() : "";
    if (token.length < 16) {
      return NextResponse.json({ error: "anon_token_required" }, { status: 401 });
    }
    actor = {
      kind: "anon",
      id: token.slice(0, 64),
      userId: null,
      displayName: typeof input.anonName === "string" ? input.anonName.trim().slice(0, 40) || null : null,
    };
  }
  return actor;
}

export async function hydrateActorName(admin: SupabaseClient, actor: UploadActor): Promise<UploadActor> {
  if (actor.kind !== "user") return actor;
  const { data: prof } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", actor.id)
    .maybeSingle();
  const profName = typeof prof?.display_name === "string" ? prof.display_name.trim() : "";
  return profName ? { ...actor, displayName: profName.slice(0, 40) } : actor;
}

export async function fetchSpaceForUpload(admin: SupabaseClient, spaceId: string): Promise<SpaceForUpload | null> {
  const { data, error } = await admin
    .from("spaces")
    .select("id, modules, stage, shared, owner_id")
    .eq("id", spaceId)
    .maybeSingle();
  if (error) throw error;
  return data as SpaceForUpload | null;
}

export async function canAccessSpace(
  admin: SupabaseClient,
  space: SpaceForUpload,
  actor: UploadActor,
): Promise<boolean> {
  if (!space.stage) return true;
  if (actor.kind === "anon") return space.shared === true;
  const role = await getProjectAccess(admin, {
    spaceId: space.id,
    ownerId: space.owner_id,
    shared: space.shared,
    userId: actor.id,
  });
  return role !== "none";
}

export function moduleExists(space: SpaceForUpload, moduleIndex: number): boolean {
  return Array.isArray(space.modules) && moduleIndex >= 0 && moduleIndex < space.modules.length;
}

export async function takePersistentRateLimit(
  admin: SupabaseClient,
  key: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("take_rate_limit", {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) {
      console.warn("[rate_limit] falling back open:", error.message);
      return true;
    }
    return data === true;
  } catch (error) {
    console.warn("[rate_limit] unavailable:", (error as Error).message);
    return true;
  }
}

export async function readSpaceUploadUsage(admin: SupabaseClient, spaceId: string): Promise<number> {
  try {
    const { data, error } = await admin.rpc("space_upload_usage", { p_space_id: spaceId });
    if (error) return 0;
    return typeof data === "number" ? data : Number(data || 0) || 0;
  } catch {
    return 0;
  }
}

export function adminClientForUpload(): SupabaseClient {
  return supabaseAdmin();
}
