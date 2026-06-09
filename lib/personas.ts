"use client";

/**
 * Test personas.
 *
 * Two fixed identities the persona switcher rotates between. Each one
 * has a stable display name + a stable anon token that the API treats
 * as the actor on collaborative writes.
 *
 * The matching `profiles` rows are seeded by migration 003. The tokens
 * are predictable on purpose — these accounts are testing scaffolding,
 * not real users.
 */

export interface Persona {
  id: string;
  displayName: string;
  /** Anon token written to localStorage when this persona is active. */
  token: string;
  /** Profile.id matching the seeded profile row. Used so collaborative
   *  state shows the right display_name when the API is hit by the
   *  matching anon token. */
  profileId: string;
  /** Background color the avatar pill uses in the switcher. */
  swatch: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "alice",
    displayName: "Alice",
    token: "persona-alice-token-aaaaaaaaaaaaaaaa",
    profileId: "persona-alice-0001",
    swatch: "#7da3c0",
  },
  {
    id: "bob",
    displayName: "Bob",
    token: "persona-bob-token-bbbbbbbbbbbbbbbbbb",
    profileId: "persona-bob-0002",
    swatch: "#d4a373",
  },
];

const ACTIVE_KEY = "magyc.persona.active";

export function getActivePersonaId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function setActivePersona(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
}

export function getActivePersona(): Persona | null {
  const id = getActivePersonaId();
  return PERSONAS.find((p) => p.id === id) ?? null;
}
