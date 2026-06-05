/**
 * Short URL-safe identifier. 10 chars from a 58-character alphabet (no
 * 0/O/I/l ambiguity) gives ~5.8 × 10^17 combinations — plenty for the
 * collision-free scale of any single human user generating spaces.
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
