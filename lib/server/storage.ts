import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSET_BUCKET } from "@/lib/server/uploadSecurity";

export const STORAGE_PROVIDER = "supabase-storage";
export const SIGNED_READ_EXPIRES_SECONDS = 6 * 60 * 60;

function storageError(message: string, detail?: string): Error {
  return new Error(detail ? `${message}: ${detail}` : message);
}

export async function createAssetUploadUrl(
  admin: SupabaseClient,
  path: string,
): Promise<{ path: string; token: string; signedUrl: string }> {
  const { data, error } = await admin.storage
    .from(ASSET_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data?.token || !data?.signedUrl) {
    throw storageError("storage_sign_failed", error?.message);
  }
  return {
    path: data.path || path,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

export async function assertAssetExists(admin: SupabaseClient, path: string): Promise<void> {
  const { error } = await admin.storage.from(ASSET_BUCKET).info(path);
  if (error) throw storageError("storage_missing", error.message);
}

export async function signAssetReadUrl(
  admin: SupabaseClient,
  path: string,
  expiresIn = SIGNED_READ_EXPIRES_SECONDS,
): Promise<string> {
  const { data, error } = await admin.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    throw storageError("storage_sign_failed", error?.message);
  }
  return data.signedUrl;
}

export async function signAssetReadUrls(
  admin: SupabaseClient,
  paths: string[],
  expiresIn = SIGNED_READ_EXPIRES_SECONDS,
): Promise<Record<string, string>> {
  const { data, error } = await admin.storage
    .from(ASSET_BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error) throw storageError("asset_sign_failed", error.message);

  const urls: Record<string, string> = {};
  for (const row of data || []) {
    if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
  }
  return urls;
}

export async function removeAssetPaths(admin: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await admin.storage.from(ASSET_BUCKET).remove(paths);
  if (error) throw storageError("storage_remove_failed", error.message);
}
