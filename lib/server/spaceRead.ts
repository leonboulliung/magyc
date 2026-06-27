import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSpaceByIdWithClient, fetchVersionModulesWithClient } from "@/lib/db";
import { getProjectAccess, type ProjectAccessRole } from "@/lib/server/projectAccess";
import type { Module, Space } from "@/lib/types";

export type SpaceReadResult = {
  space: Space;
  role: ProjectAccessRole;
};

type SpaceAccessRow = {
  id: string;
  owner_id: string | null;
  shared: boolean | null;
  stage: string | null;
  deleted_at: string | null;
};

export function canReadSpaceSnapshot(input: {
  stage: Space["stage"];
  deletedAt: number | null;
  role: ProjectAccessRole;
}): boolean {
  if (input.deletedAt !== null) return input.role === "owner";
  if (input.stage === null) return true;
  return input.role !== "none";
}

export async function authorizeSpaceViewer(
  admin: SupabaseClient,
  input: { spaceId: string; userId?: string | null },
): Promise<ProjectAccessRole | null> {
  const { data, error } = await admin
    .from("spaces")
    .select("id, owner_id, shared, stage, deleted_at")
    .eq("id", input.spaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as SpaceAccessRow;
  const stage: Space["stage"] = row.stage === null
    ? null
    : row.stage === "production" || row.stage === "handoff"
      ? row.stage
      : "brief";

  let role: ProjectAccessRole;
  if (input.userId && row.owner_id === input.userId) {
    role = "owner";
  } else if (stage === null) {
    role = "link";
  } else {
    role = await getProjectAccess(admin, {
      spaceId: row.id,
      ownerId: row.owner_id,
      shared: row.shared,
      userId: input.userId,
    });
  }

  return canReadSpaceSnapshot({
    stage,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    role,
  }) ? role : null;
}

/**
 * Service-role read followed by the same role resolution used by write APIs.
 * Returning null for both missing and forbidden projects avoids leaking ids.
 */
export async function readSpaceForViewer(
  admin: SupabaseClient,
  input: { spaceId: string; userId?: string | null },
): Promise<SpaceReadResult | null> {
  const role = await authorizeSpaceViewer(admin, input);
  if (!role) return null;
  const space = await fetchSpaceByIdWithClient(admin, input.spaceId);
  if (!space) return null;
  return { space, role };
}

export async function readVersionForViewer(
  admin: SupabaseClient,
  input: { spaceId: string; version: number; userId?: string | null },
): Promise<{ modules: Module[]; role: ProjectAccessRole } | null> {
  const role = await authorizeSpaceViewer(admin, input);
  if (!role) return null;
  const modules = await fetchVersionModulesWithClient(admin, input.spaceId, input.version);
  if (!modules) return null;
  return { modules, role };
}
