"use client";

import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/client/errors";
import { activeClientDictionary } from "@/lib/client/locale";

export type ApiJson = Record<string, unknown>;

export async function readApiJson(res: Response): Promise<ApiJson> {
  const json = await res.json().catch(() => ({}));
  return json && typeof json === "object" ? (json as ApiJson) : {};
}

export function messageFromUnknown(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function apiFailureMessage(
  json: unknown,
  fallback = activeClientDictionary().apiErrors.actionFailed,
): string {
  return apiErrorMessage(json, fallback);
}

export function showActionLoading(message: string, id?: string) {
  return toast.loading(message, id ? { id } : undefined);
}

export function showActionSuccess(
  title: string,
  options?: { id?: string; description?: string },
) {
  toast.success(title, {
    id: options?.id,
    description: options?.description,
  });
}

export function showActionError(
  title: string,
  options?: { id?: string; description?: string },
) {
  toast.error(title, {
    id: options?.id,
    description: options?.description,
  });
}

export function showApiError(
  title: string,
  json: unknown,
  options?: { id?: string; fallback?: string },
): string {
  const description = apiFailureMessage(json, options?.fallback);
  showActionError(title, { id: options?.id, description });
  return description;
}

export function showUnknownError(
  title: string,
  error: unknown,
  options?: { id?: string; fallback?: string },
): string {
  const description = messageFromUnknown(
    error,
    options?.fallback ?? activeClientDictionary().apiErrors.actionFailed,
  );
  showActionError(title, { id: options?.id, description });
  return description;
}
