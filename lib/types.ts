export type Permission = "public" | "request";

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
  displayName: string;   // user-picked handle
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

/**
 * Membership state on a card.
 *  - "joined"    — confirmed, counts toward the crew.
 *  - "requested" — pending; the owner accepts or declines.
 */
export type MemberState = "joined" | "requested";

/**
 * A user's relationship to a card. Replaces the old Joiner + Request
 * split: both live in the same table now, distinguished by `state`.
 */
export interface CardMember {
  userId: string;
  state: MemberState;
  /** Which predefined role on the card this member claimed. Empty
   *  string means "just dabei" — no specific role. */
  role: string;
  /** When the row was created (joined OR requested at — same column). */
  joinedAt: number;
  user: Profile;
}

/**
 * A role definition on a card. The owner curates the list; AI can
 * propose initial labels from the brief. Each role is a slot one
 * person can claim with "Ich mach's". `claimedBy` is the joined
 * member's profile (resolved at read time), or `null` when the slot
 * is still open.
 */
export interface CardRole {
  label: string;
  claimedBy: Profile | null;
}

/**
 * A card — the only entity in the app. Whether it feels like an "idea"
 * or "my thing" depends on YOUR relationship to it (are you a member?
 * are you the owner?), not on a global type flag.
 *
 * Fields the user might leave blank: location, startsAt, endsAt,
 * spots, permission, color, roles, modules. The app composes a
 * legible workspace from whatever the creator gave it.
 */
export interface Card {
  id: string;
  ownerId: string;
  owner: Profile;
  title: string;
  description: string;
  /** Optional. A card without a pin is fine — it's just an idea. */
  location: CardLocation | null;
  /**
   * Photon-derived place classification (osm_value: "restaurant",
   * "park", "cinema", "cafe", etc.). `null` when no venue type
   * could be inferred.
   */
  locationKind: string | null;
  /** Optional cap on how many members the card holds. `null` = open. */
  spots: number | null;
  /** "public" (instant join) or "request" (owner accepts). `null`
   *  on cards where the joining concept isn't engaged yet. */
  permission: Permission | null;
  /** Free-form tags (lowercase, hyphenated). AI suggests, user edits. */
  tags: string[];
  /** Author-picked color. Drives the dominant visual (pin, accent). */
  color: string | null;
  createdAt: number;
  /** Optional start time. `null` = the card isn't time-bound yet. */
  startsAt: number | null;
  /** Optional end time. `null` = open-ended. */
  endsAt: number | null;
  /** Optional "more info" link (Strava, Are.na, GitHub, …). */
  externalUrl: string | null;
  /** Everyone associated with this card — joined or requested. UI
   *  filters by state where it matters. */
  members: CardMember[];
  /**
   * Predefined roles on the card ("Foto", "Tonkundige", …). Owner
   * curates; AI can propose labels. Each entry is a slot — at most
   * one joined member per role. `claimedBy` is resolved at read time.
   */
  roles: CardRole[];
  /**
   * A small key/value sidebar of details — a shoot's "LOOKS", a
   * hackathon's "STACK", a dinner's "BRING". Keys are AI-suggested
   * abstractions of the creator's own intent; values are written by
   * the creator. Order preserved by client.
   */
  customFields: Record<string, string>;
  /**
   * An ordered list of short step labels. AI proposes (strict
   * abstraction, no invented specifics); the creator owns the order
   * and wording. Empty when no roadmap has been drafted.
   */
  roadmap: string[];
  /**
   * Ordered repertoire of typed sub-surfaces the AI proposes (and the
   * owner curates) to help a card land — brief, roadmap, checklist,
   * bring-list, kv-sidebar, etc.
   */
  modules: CardModule[];
  /**
   * Computed design signature — tunes title weight, accent palette,
   * pin pulse toward the mood of this card. Null until the AI has
   * run; consumers fall back to sensible defaults.
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
 * app uses to tune its existing visuals toward a particular card.
 * Generated by the AI from the card's title + description + tags +
 * (optional) module. Never an artwork — only the tuning knobs the
 * existing UI already supports.
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
