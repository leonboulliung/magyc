/**
 * The single accent palette.
 *
 * Used everywhere a deterministic-but-varied colour is needed without
 * an AI assignment: anon-actor accents, profile defaults, the test
 * personas' swatches. Previously this lived copy-pasted in three files;
 * this is now the one source.
 */
export const PALETTE = [
  "#7da3c0", // blue
  "#d4a373", // tan
  "#a3c08e", // green
  "#c0857d", // clay
  "#8d8dc0", // lilac
  "#c0bd7d", // ochre
] as const;

/** Deterministic colour for a stable id (anon token or user id). */
export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}
