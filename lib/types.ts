export type Permission = "public" | "request";

/**
 * The two object kinds in the field.
 *  - "idea"  — a thought thrown into the field. Cheap, low-commitment. Just
 *              text + optional loose location. People give a resonance Signal.
 *  - "thing" — concrete, doable. People JOIN. ≈ the original "card".
 * A "thing" is the default so every legacy card keeps its meaning.
 */
export type CardKind = "idea" | "thing";

export interface CardLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface Socials {
  instagram?: string;
  telegram?: string;
  whatsapp?: string;
  site?: string;
}

export interface Profile {
  id: string;            // Clerk user ID, e.g. "user_2abc..."
  phone: string | null;  // E.164 from Clerk, may be null if not yet synced
  displayName: string;   // user-picked handle, e.g. "leonparis"
  avatarUrl: string | null;
  socials: Socials | null;
  interests: string[] | null;
  /** Short editorial bio (≤200 chars). Shown on profile + post detail. */
  bio: string | null;
  createdAt: number;
  /** Last time the user changed their `displayName`. Drives the 7-day cooldown. */
  usernameChangedAt?: number | null;
  /** Admin-set flag. Banned profiles are filtered out of public surfaces
   *  and blocked from writes in the API routes. */
  banned?: boolean;
}

export interface CardJoiner {
  userId: string;
  role: string;
  joinedAt: number;
  user: Profile;
}

export interface CardRequest {
  userId: string;
  requestedAt: number;
  user: Profile;
}

/**
 * A resonance Signal on an idea — "I'd want this to exist / I'd help make it
 * real." Lighter than a joiner: no role, no accept/decline. It is INTENT.
 * Accumulated signalers are the warm, ready crew an idea carries forward when
 * it transforms into a thing.
 */
export interface Signal {
  userId: string;
  createdAt: number;
  user: Profile;
}

export interface Card {
  id: string;
  /** "idea" or "thing". Drives the whole visual + behavioral split. */
  kind: CardKind;
  ownerId: string;
  owner: Profile;
  title: string;
  description: string;
  /**
   * An idea may have only a loose location, or none at all. A thing always
   * resolves one before it's joinable.
   */
  location: CardLocation | null;
  /**
   * Photon-derived place classification (osm_value: "restaurant",
   * "park", "cinema", "cafe", etc.). `null` when the location came
   * from the local quartier index (no venue type) or the geocoder
   * didn't tag it.
   */
  locationKind: string | null;
  /** Number of spots on a thing. `null` on an idea (no commitment yet). */
  spots: number | null;
  /** Join permission on a thing. `null` on an idea. */
  permission: Permission | null;
  /** Free-form tags (lowercase, hyphenated). AI suggests, user can edit. */
  tags: string[];
  /** Author-picked color. Drives the dominant visual (strip, pin, hero). */
  color: string | null;
  createdAt: number;
  /**
   * Repurposed column: when a thing actually starts. `null` on an idea
   * (timing crystallizes only as needed).
   */
  expiresAt: number | null;
  /** Optional end time. `null` = open-ended ("until vibe ends"). */
  endsAt: number | null;
  /** Optional "more info" link (GitHub, Strava, Are.na, etc.). */
  externalUrl: string | null;
  durationDays: number | null;
  archived: boolean;
  joiners: CardJoiner[];
  requests: CardRequest[];
  /** Resonance signals — populated for ideas, empty for things. */
  signals: Signal[];
  /**
   * A small key/value sidebar of details that suit this particular thing —
   * a shoot's "LOOKS", a hackathon's "STACK", a dinner's "BRING". Keys are
   * AI-suggested abstractions of the creator's own intent (never invented),
   * values are written by the creator. Order preserved by client.
   */
  customFields: Record<string, string>;
  /**
   * An ordered list of short labels describing the abstract steps the
   * creator needs to make this thing happen. AI proposes the labels
   * (strict abstraction, no invented specifics); the creator owns the
   * order and the wording. Empty when no roadmap has been drafted.
   */
  roadmap: string[];
  /**
   * If this thing was created by forking someone else's idea, these three
   * fields carry an immutable credit to the origin. Stored as a snapshot
   * so the stamp survives deletion of the original idea. `null` when the
   * card wasn't forked (the common case).
   */
  forkedFromCardId: string | null;
  forkedFromOwnerId: string | null;
  forkedFromTitle: string | null;
  /** Hydrated origin owner profile when available — for the stamp UI. */
  forkedFromOwner: Profile | null;
  /**
   * Ordered repertoire of typed sub-surfaces the AI proposes (and the
   * owner curates) to help a thing land — brief, roadmap, checklist,
   * bring-list, kv-sidebar. The AI never invents specifics; it only
   * abstracts the structure from what the creator already wrote.
   */
  modules: CardModule[];
  /**
   * Computed design signature — tunes hero gradient, title weight, pin
   * pulse, map warmth toward the mood of this thing. Null until the
   * AI has run; consumers apply sensible defaults.
   */
  signature: CardSignature | null;
}

/**
 * A typed module that lives in `Card.modules`. Discriminated by `type`.
 * Module types come online one at a time; the sanitizer in the PATCH
 * route gates which types are currently valid.
 */
export type CardModule =
  | { type: "brief"; text: string }
  | { type: "roadmap"; steps: string[] }
  | { type: "checklist"; items: string[] }
  | { type: "bring"; items: string[] }
  | { type: "kv"; entries: { key: string; value: string }[] }
  | { type: "moodboard"; refs: { url: string; caption?: string }[] }
  | { type: "setlist"; items: { time?: string; title: string }[] }
  | { type: "reflist"; items: { url: string; caption?: string }[] };

/**
 * A computed "signature" — a small bundle of design parameters the
 * app uses to tune its existing visuals toward a particular thing.
 * Generated by the AI from the card's title + description + tags +
 * (optional) module. Never an artwork — only the tuning knobs the
 * existing UI already supports (type weight, palette, pin rhythm,
 * map warmth, geometric language, motion intensity).
 *
 * `null` until the model has run (and stays null on AI failure).
 * Consumers fall back to sensible defaults when null.
 */
export interface CardSignature {
  /** Two harmonious accent colors. palette[0] is the primary. */
  palette: [string, string];
  /** Map / hero warmth bias. 0 = cool, 1 = warm. */
  warmth: number;
  /** Pin pulse base rate. 0 = still, 1 = electric. */
  tempo: number;
  /** Editorial type weight axis (clamped to 600..900 by the consumer
   *  so the visual stays in the editorial register). */
  weight: number;
  /** Visual shape language for the pin + decorative elements. */
  geometry: "round" | "sharp" | "soft" | "linear";
  /** Rhythm of surface filling (hairlines, gaps). 0 = sparse, 1 = dense. */
  density: number;
  /** Motion intensity in idle / hover surfaces. 0 = still, 1 = active. */
  kinetic: number;
}

/** The set of module types currently accepted by the PATCH sanitizer
 *  and the AI suggester. All eight are live. */
export const ALLOWED_MODULE_TYPES: readonly CardModule["type"][] = [
  "brief",
  "roadmap",
  "checklist",
  "bring",
  "kv",
  "moodboard",
  "setlist",
  "reflist",
] as const;

export interface TrackEntry {
  card: Card;
  role: string;
  at: number;
  isCreator: boolean;
}
