/**
 * Role labels sanitizer — shared by POST /api/cards and PATCH /api/cards/[id].
 *
 * Input shape is liberal (string[] or {label}[]). Output is a clean string[]
 * the API stores as jsonb (each entry serialized as `{ label }` to leave
 * room for future per-role metadata without a re-migration). Caps at 8
 * labels, deduplicates case-insensitively, drops empties.
 */

export type RoleInput = string | { label?: unknown } | unknown;

export function sanitizeRoleLabels(raw: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let label: string | null = null;
    if (typeof item === "string") label = item;
    else if (item && typeof item === "object") {
      const v = (item as { label?: unknown }).label;
      if (typeof v === "string") label = v;
    }
    if (!label) continue;
    const clean = label.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= 8) break;
  }
  return out;
}

/** Wrap labels in the jsonb storage shape `{ label }`. */
export function rolesForStorage(labels: string[]): { label: string }[] {
  return labels.map((label) => ({ label }));
}
