/**
 * v2 — Spaces.
 *
 * A Space is the workspace that emerges from a single piece of input.
 * The owner writes a thought / idea / question / concern / plan; the AI
 * composes a set of typed primitives that frame and open the input;
 * the space gets a shareable URL.
 *
 * Visitors who arrive via the URL can contribute to specific primitives
 * (a response, a claim on a help-needed slot, a resource link).
 */

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: number;
}

/**
 * A typed primitive that lives in `Space.primitives`. Discriminated by
 * `type`. Some primitives ship with starter content the AI fills in
 * (brief, open_questions, help_needed). Others stay empty until visitors
 * fill them (voices, resources, next_steps).
 */
export type Primitive =
  | { type: "brief"; text: string }
  | { type: "open_questions"; questions: string[] }
  | { type: "help_needed"; asks: string[] }
  | { type: "voices" }
  | { type: "resources"; items: { url: string; caption?: string }[] }
  | { type: "next_steps"; steps: string[] }
  | { type: "place"; label: string };

export type PrimitiveType = Primitive["type"];

export const ALLOWED_PRIMITIVE_TYPES: readonly PrimitiveType[] = [
  "brief",
  "open_questions",
  "help_needed",
  "voices",
  "resources",
  "next_steps",
  "place",
] as const;

/** A visitor's contribution to a specific primitive on a space. */
export interface Contribution {
  id: string;
  spaceId: string;
  primitiveIndex: number;
  userId: string;
  user: Profile;
  /** Type of contribution — depends on the primitive kind it targets. */
  kind: "voice" | "claim" | "resource";
  data: ContributionData;
  createdAt: number;
}

export type ContributionData =
  | { kind: "voice"; text: string }
  | { kind: "claim"; ask: string }
  | { kind: "resource"; url: string; caption?: string };

export interface Space {
  id: string;
  ownerId: string;
  owner: Profile;
  inputText: string;
  title: string;
  language: string;
  primitives: Primitive[];
  contributions: Contribution[];
  createdAt: number;
}
