import type { Module, Space } from "@/lib/types";

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export async function fetchSpaceSnapshot(spaceId: string): Promise<Space | null> {
  const response = await fetch(`/api/spaces/${encodeURIComponent(spaceId)}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 404) return null;
  const json = await readJson(response);
  if (!response.ok) {
    const error = json && typeof json === "object" && "error" in json
      ? String((json as { error?: unknown }).error)
      : "space_read_failed";
    throw new Error(error);
  }
  return (json as { space?: Space } | null)?.space ?? null;
}

export async function fetchVersionSnapshot(spaceId: string, version: number): Promise<Module[] | null> {
  const response = await fetch(
    `/api/spaces/${encodeURIComponent(spaceId)}/versions/${encodeURIComponent(String(version))}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  if (response.status === 404) return null;
  const json = await readJson(response);
  if (!response.ok) throw new Error("version_read_failed");
  return (json as { modules?: Module[] } | null)?.modules ?? null;
}
