import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTRACT_VERSION } from "@/lib/contract";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

export function isMissingColumn(error: unknown, column: string): boolean {
  const e = error as { message?: string; details?: string; hint?: string; code?: string } | null;
  const text = [e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(" ").toLowerCase();
  return text.includes(column.toLowerCase());
}

/**
 * Insert a space with a persisted contract version when the DB migration is
 * present. If a deploy reaches production before the migration, fall back to
 * the old row shape so project creation keeps working.
 */
export async function insertSpaceRow(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  if (!FEATURE_FLAGS.spaceContractVersion) {
    const { error } = await admin.from("spaces").insert(row);
    return { error: error ? { message: error.message } : null };
  }

  const withContract = { ...row, contract_version: CONTRACT_VERSION };
  const primary = await admin.from("spaces").insert(withContract);
  if (primary.error && isMissingColumn(primary.error, "contract_version")) {
    console.warn("[spaces] contract_version column missing; retrying legacy insert.");
    const fallback = await admin.from("spaces").insert(row);
    return { error: fallback.error ? { message: fallback.error.message } : null };
  }
  return { error: primary.error ? { message: primary.error.message } : null };
}
