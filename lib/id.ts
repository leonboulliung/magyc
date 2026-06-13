/**
 * Short URL-safe identifier. 10 chars from a 58-character alphabet
 * (no 0/O/I/l ambiguity) — plenty for our scale.
 */
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const LENGTH = 10;

export function newId(): string {
  const bytes = new Uint8Array(LENGTH);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < LENGTH; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Client-side id for an optimistic state entry, namespaced by a short
 *  prefix (e.g. "q" question, "a" answer, "m" message, "n" note). Backed
 *  by the crypto `newId()` — replaces the per-renderer `Math.random()`
 *  one-offs. Collisions only need avoiding within one widget's list. */
export function newLocalId(prefix: string): string {
  return `${prefix}_${newId()}`;
}

/** Anonymous owner / contributor token. Same alphabet, longer (24
 *  chars) so collision is statistically impossible. The browser
 *  stores this in localStorage. */
export function newAnonToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 24; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < 24; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
