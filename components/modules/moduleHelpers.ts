import type { CardModule } from "@/lib/types";

/**
 * Replace the existing module of the same `type` with `next`, or append
 * if none exists. Preserves the order of other modules. Used by every
 * module-typed editor so they can mutate the array without stomping
 * over each other.
 */
export function upsertModule(modules: CardModule[], next: CardModule): CardModule[] {
  const idx = modules.findIndex((m) => m.type === next.type);
  if (idx < 0) return [...modules, next];
  const out = modules.slice();
  out[idx] = next;
  return out;
}

/** Drop every module of the given type from the array. */
export function removeModule(
  modules: CardModule[],
  type: CardModule["type"],
): CardModule[] {
  return modules.filter((m) => m.type !== type);
}
