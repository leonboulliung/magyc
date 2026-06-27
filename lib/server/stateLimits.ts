import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuleStateKind } from "@/lib/types";

/**
 * Per-module ceilings for append-only collaborative state. Single-row kinds
 * replace existing rows, while edit rows are compacted by migration 024.
 */
export const APPEND_STATE_LIMITS = {
  voice: 500,
  add: 500,
  upload: 250,
  stroke: 1_200,
} as const satisfies Partial<Record<ModuleStateKind, number>>;

export type LimitedStateKind = keyof typeof APPEND_STATE_LIMITS;

export function appendStateLimit(kind: ModuleStateKind): number | null {
  return kind in APPEND_STATE_LIMITS
    ? APPEND_STATE_LIMITS[kind as LimitedStateKind]
    : null;
}

export async function hasStateCapacity(
  admin: SupabaseClient,
  spaceId: string,
  moduleIndex: number,
  kind: LimitedStateKind,
): Promise<boolean> {
  const { count, error } = await admin
    .from("module_state")
    .select("id", { count: "exact", head: true })
    .eq("space_id", spaceId)
    .eq("module_index", moduleIndex)
    .eq("kind", kind);
  if (error) throw error;
  return (count ?? 0) < APPEND_STATE_LIMITS[kind];
}
