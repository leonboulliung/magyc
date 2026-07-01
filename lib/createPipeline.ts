import type { Module } from "@/lib/types";

/**
 * Combine reusable preset structure with explicit answers from the current
 * creation run. The current user's clarification is the most recent intent and
 * therefore wins when both sources configure the same element type.
 */
export function mergeSeededModules(presetModules: Module[], configuredModules: Module[]): Module[] {
  const merged: Module[] = [];
  const used = new Set<string>();
  for (const module of [...configuredModules, ...presetModules]) {
    if (used.has(module.type)) continue;
    used.add(module.type);
    merged.push(module);
  }
  return merged;
}

/** Keep workflow rules separate from user project facts and cap each source. */
export function workflowRules(...groups: unknown[]): string[] {
  const output: string[] = [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const value of group) {
      if (typeof value !== "string") continue;
      const rule = value.replace(/\s+/g, " ").trim().slice(0, 500);
      if (!rule || output.includes(rule)) continue;
      output.push(rule);
      if (output.length >= 18) return output;
    }
  }
  return output;
}

/** Update a free clarification answer without retaining erased stale text. */
export function withClarifyAnswer(
  answers: Record<string, string>,
  stepId: string,
  value: string,
): Record<string, string> {
  const next = { ...answers };
  const cleaned = value.trim();
  if (cleaned) next[stepId] = cleaned;
  else delete next[stepId];
  return next;
}
