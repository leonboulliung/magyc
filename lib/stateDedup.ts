import type { ModuleStateKind } from "./types";

/**
 * Single source of truth for the "single active row per actor" dedup rules.
 *
 * Three state kinds keep at most one active row per actor (per scope), so both
 * the optimistic client apply (`applyActionLocally` in lib/state.ts) and the
 * server write (`app/api/spaces/[id]/state/route.ts`) must "delete any prior
 * matching row, then maybe insert the new one" using the SAME keys. Those rules
 * used to be hand-rolled in both places — a silent drift hazard (AGENTS.md:
 * "change one, change the other"). They now live here.
 */
export type SingleActiveKind = "vote" | "check" | "claim";

export interface SingleActiveRule {
  /** The `data` field (besides actor + module) that scopes one active row.
   *  `null` = the prior row is matched by actor + module alone, so a new row
   *  replaces any previous one regardless of payload (votes). */
  scopeField: "itemKey" | "slotLabel" | null;
  /** True when the action only retracts the prior row (delete-only, no insert):
   *  empty vote option, uncheck, or unclaim. */
  isRetraction: (data: Record<string, unknown>) => boolean;
}

const asStr = (v: unknown): string => (typeof v === "string" ? v : "");

export const SINGLE_ACTIVE_RULES: Record<SingleActiveKind, SingleActiveRule> = {
  vote: { scopeField: null, isRetraction: (d) => !asStr(d.option) },
  check: { scopeField: "itemKey", isRetraction: (d) => !d.checked },
  claim: { scopeField: "slotLabel", isRetraction: (d) => d.claimed === false },
};

/** The rule for a kind, or null for plain-append kinds (voice/edit/add/…). */
export function singleActiveRule(kind: ModuleStateKind): SingleActiveRule | null {
  return (SINGLE_ACTIVE_RULES as Record<string, SingleActiveRule>)[kind] ?? null;
}

/** The scope value used to match a prior row, coerced the way both sides expect. */
export function scopeValue(rule: SingleActiveRule, data: Record<string, unknown>): string {
  return rule.scopeField ? asStr(data[rule.scopeField]) : "";
}
