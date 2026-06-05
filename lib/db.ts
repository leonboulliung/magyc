import { supabase } from "./supabase";
import type {
  Card, CardMember, CardRole, MemberState, Profile, Socials, TrackEntry,
} from "./types";

// ============================================================
// Row → TS mapping (DB uses snake_case; UI uses camelCase)
// ============================================================

type ProfileRow = {
  id: string;
  phone: string | null;
  display_name: string;
  avatar_url: string | null;
  socials: Socials | null;
  interests: string[] | null;
  bio: string | null;
  created_at: string;
  banned?: boolean;
};

type MemberRow = {
  user_id: string;
  state: MemberState;
  role: string;
  joined_at: string;
  user: ProfileRow | null;
};

type CardRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  location: { lat: number; lng: number; label: string } | null;
  location_kind: string | null;
  spots: number | null;
  permission: "public" | "request" | null;
  tags: string[] | null;
  color: string | null;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
  external_url: string | null;
  custom_fields: Record<string, unknown> | null;
  roadmap: unknown[] | null;
  modules: unknown[] | null;
  signature: Record<string, unknown> | null;
  roles: unknown[] | null;
  owner: ProfileRow | null;
  members: MemberRow[] | null;
};

/**
 * Coerce whatever the JSONB returns to a clean `Record<string, string>`.
 * Bad data is silently dropped — better an empty sidebar than a runtime
 * crash on a stale row.
 */
function mapCustomFields(raw: Record<string, unknown> | null): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k === "string" && k && typeof v === "string") out[k] = v;
  }
  return out;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const GEOMETRY_SET = new Set(["round", "sharp", "soft", "linear"]);

/**
 * JSONB → CardSignature: shape-validate every field, drop the whole
 * thing if any required field is bogus. Better to fall back to defaults
 * than render with a half-broken signature.
 */
function mapSignature(
  raw: Record<string, unknown> | null,
): import("./types").CardSignature | null {
  if (!raw || typeof raw !== "object") return null;
  const pal = (raw as { palette?: unknown }).palette;
  if (!Array.isArray(pal) || pal.length < 2) return null;
  const p0 = typeof pal[0] === "string" && HEX_RE.test(pal[0]) ? (pal[0] as string).toLowerCase() : null;
  const p1 = typeof pal[1] === "string" && HEX_RE.test(pal[1]) ? (pal[1] as string).toLowerCase() : null;
  if (!p0 || !p1) return null;

  const clamp01 = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
  const warmth = clamp01((raw as { warmth?: unknown }).warmth);
  const tempo = clamp01((raw as { tempo?: unknown }).tempo);
  const density = clamp01((raw as { density?: unknown }).density);
  const kinetic = clamp01((raw as { kinetic?: unknown }).kinetic);

  const wRaw = (raw as { weight?: unknown }).weight;
  const weight =
    typeof wRaw === "number" && Number.isFinite(wRaw)
      ? Math.max(100, Math.min(900, Math.round(wRaw)))
      : 900;

  const gRaw = (raw as { geometry?: unknown }).geometry;
  const geometry =
    typeof gRaw === "string" && GEOMETRY_SET.has(gRaw)
      ? (gRaw as "round" | "sharp" | "soft" | "linear")
      : "round";

  return { palette: [p0, p1], warmth, tempo, weight, geometry, density, kinetic };
}

/**
 * JSONB → role labels. Each entry is `{ label: string }`. We strip empties,
 * dedupe (case-insensitive), and cap at 8 to keep the join surface scannable.
 */
function mapRoleLabels(raw: unknown[] | null): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let label: string | null = null;
    if (typeof item === "string") label = item;
    else if (item && typeof item === "object" && typeof (item as { label?: unknown }).label === "string") {
      label = (item as { label: string }).label;
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

/** Resolve a list of role labels against the joined members — each
 *  label becomes a CardRole with `claimedBy` set when a joined member
 *  picked that role (case-insensitive match against `members.role`). */
function resolveRoles(labels: string[], members: CardMember[]): CardRole[] {
  return labels.map((label) => {
    const lc = label.toLowerCase();
    const taker = members.find(
      (m) => m.state === "joined" && m.role && m.role.toLowerCase() === lc,
    );
    return { label, claimedBy: taker ? taker.user : null };
  });
}

/** JSONB → string[]: drop anything that isn't a non-empty string. */
function mapRoadmap(raw: unknown[] | null): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string") {
      const s = v.trim();
      if (s) out.push(s.slice(0, 160));
    }
  }
  return out;
}

/**
 * JSONB → CardModule[]: shape-validate each element, drop anything that
 * doesn't fit a known module type. Bad/stale data is silently dropped so
 * the UI never has to null-guard. Caps protect against blown-up rows.
 */
function mapModules(raw: unknown[] | null): import("./types").CardModule[] {
  if (!Array.isArray(raw)) return [];
  const out: import("./types").CardModule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    switch (rec.type) {
      case "brief": {
        if (typeof rec.text === "string") {
          const t = rec.text.trim().slice(0, 240);
          if (t) out.push({ type: "brief", text: t });
        }
        break;
      }
      case "roadmap": {
        if (Array.isArray(rec.steps)) {
          const steps: string[] = [];
          for (const s of rec.steps) {
            if (typeof s === "string") {
              const v = s.trim().slice(0, 160);
              if (v) steps.push(v);
              if (steps.length >= 8) break;
            }
          }
          if (steps.length > 0) out.push({ type: "roadmap", steps });
        }
        break;
      }
      case "checklist": {
        if (Array.isArray(rec.items)) {
          const items: string[] = [];
          for (const s of rec.items) {
            if (typeof s === "string") {
              const v = s.trim().slice(0, 160);
              if (v) items.push(v);
              if (items.length >= 12) break;
            }
          }
          if (items.length > 0) out.push({ type: "checklist", items });
        }
        break;
      }
      case "bring": {
        if (Array.isArray(rec.items)) {
          const items: string[] = [];
          for (const s of rec.items) {
            if (typeof s === "string") {
              const v = s.trim().slice(0, 80);
              if (v) items.push(v);
              if (items.length >= 16) break;
            }
          }
          if (items.length > 0) out.push({ type: "bring", items });
        }
        break;
      }
      case "kv": {
        if (Array.isArray(rec.entries)) {
          const entries: { key: string; value: string }[] = [];
          for (const e of rec.entries) {
            if (!e || typeof e !== "object") continue;
            const er = e as Record<string, unknown>;
            if (typeof er.key === "string" && typeof er.value === "string") {
              const k = er.key.trim().slice(0, 12);
              const v = er.value.trim().slice(0, 200);
              if (k && v) entries.push({ key: k, value: v });
            }
            if (entries.length >= 6) break;
          }
          if (entries.length > 0) out.push({ type: "kv", entries });
        }
        break;
      }
      case "moodboard": {
        if (Array.isArray(rec.refs)) {
          const refs: { url: string; caption?: string }[] = [];
          for (const r of rec.refs) {
            if (!r || typeof r !== "object") continue;
            const rr = r as Record<string, unknown>;
            if (typeof rr.url !== "string") continue;
            const u = rr.url.trim().slice(0, 500);
            if (!/^https?:\/\/[^\s]+$/i.test(u)) continue;
            const c = typeof rr.caption === "string"
              ? rr.caption.trim().slice(0, 80)
              : undefined;
            refs.push(c ? { url: u, caption: c } : { url: u });
            if (refs.length >= 12) break;
          }
          if (refs.length > 0) out.push({ type: "moodboard", refs });
        }
        break;
      }
      case "setlist": {
        if (Array.isArray(rec.items)) {
          const items: { time?: string; title: string }[] = [];
          for (const it of rec.items) {
            if (!it || typeof it !== "object") continue;
            const ir = it as Record<string, unknown>;
            if (typeof ir.title !== "string") continue;
            const t = ir.title.trim().slice(0, 120);
            if (!t) continue;
            const tm = typeof ir.time === "string"
              ? ir.time.trim().slice(0, 10)
              : undefined;
            const okTime = tm && /^\d{1,2}(:\d{2})?$/.test(tm) ? tm : undefined;
            items.push(okTime ? { time: okTime, title: t } : { title: t });
            if (items.length >= 12) break;
          }
          if (items.length > 0) out.push({ type: "setlist", items });
        }
        break;
      }
      case "reflist": {
        if (Array.isArray(rec.items)) {
          const items: { url: string; caption?: string }[] = [];
          for (const it of rec.items) {
            if (!it || typeof it !== "object") continue;
            const ir = it as Record<string, unknown>;
            if (typeof ir.url !== "string") continue;
            const u = ir.url.trim().slice(0, 500);
            if (!/^https?:\/\/[^\s]+$/i.test(u)) continue;
            const c = typeof ir.caption === "string"
              ? ir.caption.trim().slice(0, 120)
              : undefined;
            items.push(c ? { url: u, caption: c } : { url: u });
            if (items.length >= 12) break;
          }
          if (items.length > 0) out.push({ type: "reflist", items });
        }
        break;
      }
    }
    if (out.length >= 8) break;
  }
  return out;
}

const blankProfile = (id: string): Profile => ({
  id,
  phone: null,
  displayName: `creator-${id.slice(-4) || "0000"}`,
  avatarUrl: null,
  socials: null,
  interests: null,
  bio: null,
  createdAt: 0,
});

function mapProfile(row: ProfileRow | null, fallbackId = ""): Profile {
  if (!row) return blankProfile(fallbackId);
  return {
    id: row.id,
    phone: row.phone,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    socials: row.socials ?? null,
    interests: row.interests ?? null,
    bio: row.bio ?? null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
    banned: !!row.banned,
  };
}

function mapMember(row: MemberRow): CardMember {
  return {
    userId: row.user_id,
    state: row.state === "requested" ? "requested" : "joined",
    role: row.role || "",
    joinedAt: new Date(row.joined_at).getTime(),
    user: mapProfile(row.user, row.user_id),
  };
}

function mapCard(row: CardRow): Card {
  const members = (row.members || []).map(mapMember);
  const roleLabels = mapRoleLabels(row.roles ?? null);
  return {
    id: row.id,
    ownerId: row.owner_id,
    owner: mapProfile(row.owner, row.owner_id),
    title: row.title,
    description: row.description || "",
    location: row.location ?? null,
    locationKind: row.location_kind ?? null,
    spots: row.spots ?? null,
    permission: row.permission ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    color: row.color ?? null,
    createdAt: new Date(row.created_at).getTime(),
    startsAt: row.starts_at ? new Date(row.starts_at).getTime() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).getTime() : null,
    externalUrl: row.external_url ?? null,
    members,
    customFields: mapCustomFields(row.custom_fields ?? null),
    roadmap: mapRoadmap(row.roadmap ?? null),
    modules: mapModules(row.modules ?? null),
    signature: mapSignature(row.signature ?? null),
    roles: resolveRoles(roleLabels, members),
  };
}

const CARD_SELECT = `
  id, owner_id, title, description, location, location_kind, spots, permission, tags, color,
  created_at, starts_at, ends_at, external_url, custom_fields, roadmap, modules, signature, roles,
  owner:profiles!cards_owner_id_fkey(id, phone, display_name, avatar_url, socials, interests, bio, created_at, banned),
  members:members(user_id, state, role, joined_at,
    user:profiles!members_user_id_fkey(id, phone, display_name, avatar_url, socials, interests, bio, created_at, banned)
  )
`;

// ============================================================
// Queries (read-only — go through anon key from client)
// ============================================================

/**
 * Every active card in the field. No idea/thing split anymore — a
 * card is a card. Cards with a `starts_at` in the past are filtered
 * out (they've happened). Cards without a start time stay visible
 * indefinitely (they're open-ended intentions).
 */
export async function fetchActiveCards(): Promise<Card[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .or(`starts_at.is.null,starts_at.gt.${nowIso}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as unknown as CardRow[])
    .map(mapCard)
    // Hide cards by banned creators.
    .filter((c) => !c.owner.banned)
    // Hide cards once the joined-member count hits the cap.
    .filter(
      (c) =>
        c.spots == null ||
        c.members.filter((m) => m.state === "joined").length < c.spots,
    );
}

/**
 * Convenience for surfaces that historically asked for "the whole
 * field" as { ideas, things } — kept for back-compat during the
 * structural rewrite. Both arrays return the same Card[] now.
 */
export async function fetchField(): Promise<{ ideas: Card[]; things: Card[] }> {
  const cards = await fetchActiveCards();
  return { ideas: cards, things: cards };
}

/** IDs of everyone `userId` follows (public read via anon client). */
export async function fetchFollowingIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  if (error) return [];
  return (data || []).map((r) => (r as { following_id: string }).following_id);
}

/** How many people follow `userId`. */
export async function fetchFollowerCount(userId: string): Promise<number> {
  if (!userId) return 0;
  const { count } = await supabase
    .from("follows")
    .select("follower_id", { head: true, count: "exact" })
    .eq("following_id", userId);
  return count ?? 0;
}

/** Whether `followerId` follows `followingId`. */
export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (!followerId || !followingId) return false;
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  return !!data;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, phone, display_name, avatar_url, socials, interests, bio, created_at, banned")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as unknown as ProfileRow) : null;
}

export async function fetchCardById(id: string): Promise<Card | null> {
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCard(data as unknown as CardRow) : null;
}

export async function fetchCardsByOwner(ownerId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as unknown as CardRow[]).map(mapCard);
}

/**
 * Every card the user has created OR joined — the foundation for
 * "Mein Raum". Sorted most-recent first.
 */
export async function fetchTrackRecord(userId: string): Promise<TrackEntry[]> {
  const [{ data: created }, { data: memberships }] = await Promise.all([
    supabase.from("cards").select(CARD_SELECT).eq("owner_id", userId),
    supabase
      .from("members")
      .select(`role, joined_at, state, card:cards(${CARD_SELECT})`)
      .eq("user_id", userId)
      .eq("state", "joined"),
  ]);

  const entries: TrackEntry[] = [];

  for (const row of (created || []) as unknown as CardRow[]) {
    const card = mapCard(row);
    entries.push({ card, role: "CREATOR", at: card.createdAt, isCreator: true });
  }

  for (const row of (memberships || []) as unknown as {
    role: string;
    joined_at: string;
    state: MemberState;
    card: CardRow | null;
  }[]) {
    if (!row.card) continue;
    const card = mapCard(row.card);
    if (card.owner.banned) continue;
    entries.push({
      card,
      role: (row.role || "JOINED").toUpperCase(),
      at: new Date(row.joined_at).getTime(),
      isCreator: false,
    });
  }

  return entries.sort((a, b) => b.at - a.at);
}
