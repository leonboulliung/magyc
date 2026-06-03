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
}

export interface TrackEntry {
  card: Card;
  role: string;
  at: number;
  isCreator: boolean;
}
