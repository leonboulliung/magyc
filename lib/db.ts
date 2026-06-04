import { supabase } from "./supabase";
import type {
  Card, CardJoiner, CardKind, CardRequest, Profile, Signal, Socials, TrackEntry,
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

type JoinerRow = {
  user_id: string;
  role: string;
  joined_at: string;
  user: ProfileRow | null;
};

type RequestRow = {
  user_id: string;
  requested_at: string;
  user: ProfileRow | null;
};

type SignalRow = {
  user_id: string;
  created_at: string;
  user: ProfileRow | null;
};

type CardRow = {
  id: string;
  kind: CardKind | null;
  owner_id: string;
  title: string;
  description: string;
  location: { lat: number; lng: number; label: string } | null;
  spots: number | null;
  permission: "public" | "request" | null;
  tags: string[] | null;
  color: string | null;
  created_at: string;
  expires_at: string | null;
  ends_at: string | null;
  external_url: string | null;
  duration_days: number | null;
  archived: boolean;
  custom_fields: Record<string, unknown> | null;
  roadmap: unknown[] | null;
  modules: unknown[] | null;
  signature: Record<string, unknown> | null;
  forked_from_card_id: string | null;
  forked_from_owner_id: string | null;
  forked_from_title: string | null;
  owner: ProfileRow | null;
  forked_from_owner: ProfileRow | null;
  joiners: JoinerRow[] | null;
  requests: RequestRow[] | null;
  signals: SignalRow[] | null;
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
            // Allow HH or HH:MM (24h); otherwise drop the time.
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
  displayName: `paris-${id.slice(-4) || "0000"}`,
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

function mapJoiner(row: JoinerRow): CardJoiner {
  return {
    userId: row.user_id,
    role: row.role || "",
    joinedAt: new Date(row.joined_at).getTime(),
    user: mapProfile(row.user, row.user_id),
  };
}

function mapRequest(row: RequestRow): CardRequest {
  return {
    userId: row.user_id,
    requestedAt: new Date(row.requested_at).getTime(),
    user: mapProfile(row.user, row.user_id),
  };
}

function mapSignal(row: SignalRow): Signal {
  return {
    userId: row.user_id,
    createdAt: new Date(row.created_at).getTime(),
    user: mapProfile(row.user, row.user_id),
  };
}

function mapCard(row: CardRow): Card {
  return {
    id: row.id,
    kind: row.kind === "idea" ? "idea" : "thing",
    ownerId: row.owner_id,
    owner: mapProfile(row.owner, row.owner_id),
    title: row.title,
    description: row.description || "",
    location: row.location ?? null,
    spots: row.spots ?? null,
    permission: row.permission ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    color: row.color ?? null,
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).getTime() : null,
    externalUrl: row.external_url ?? null,
    durationDays: row.duration_days ?? null,
    archived: row.archived,
    joiners: (row.joiners || []).map(mapJoiner),
    requests: (row.requests || []).map(mapRequest),
    signals: (row.signals || []).map(mapSignal),
    customFields: mapCustomFields(row.custom_fields ?? null),
    roadmap: mapRoadmap(row.roadmap ?? null),
    modules: mapModules(row.modules ?? null),
    signature: mapSignature(row.signature ?? null),
    forkedFromCardId: row.forked_from_card_id ?? null,
    forkedFromOwnerId: row.forked_from_owner_id ?? null,
    forkedFromTitle: row.forked_from_title ?? null,
    forkedFromOwner: row.forked_from_owner_id
      ? mapProfile(row.forked_from_owner, row.forked_from_owner_id)
      : null,
  };
}

const CARD_SELECT = `
  id, kind, owner_id, title, description, location, spots, permission, tags, color,
  created_at, expires_at, ends_at, external_url, duration_days, archived, custom_fields, roadmap, modules, signature,
  forked_from_card_id, forked_from_owner_id, forked_from_title,
  owner:profiles!cards_owner_id_fkey(id, phone, display_name, avatar_url, socials, interests, bio, created_at, banned),
  forked_from_owner:profiles!cards_forked_from_owner_id_fkey(id, phone, display_name, avatar_url, socials, interests, bio, created_at, banned),
  joiners:joiners(user_id, role, joined_at,
    user:profiles!joiners_user_id_fkey(id, phone, display_name, avatar_url, socials, interests, bio, created_at, banned)
  ),
  requests:join_requests(user_id, requested_at,
    user:profiles!join_requests_user_id_fkey(id, phone, display_name, avatar_url, socials, interests, bio, created_at, banned)
  ),
  signals:signals(user_id, created_at,
    user:profiles!signals_user_id_fkey(id, phone, display_name, avatar_url, socials, interests, bio, created_at, banned)
  )
`;

// ============================================================
// Queries (read-only — go through anon key from client)
// ============================================================

/**
 * Live "things" only — concrete, joinable, not yet started, not full.
 * `expires_at` holds the event START time (legacy column name).
 * Kept as the canonical name so existing map/feed callers keep working.
 */
export async function fetchActiveCards(): Promise<Card[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .eq("kind", "thing")
    .eq("archived", false)
    .gt("expires_at", nowIso) // expires_at column now holds the event start time
    .order("expires_at", { ascending: true });
  if (error) throw error;
  return ((data || []) as unknown as CardRow[])
    .map(mapCard)
    // Hide things from public view once their crew is full.
    .filter((c) => c.spots == null || c.joiners.length < c.spots)
    // Banned owners are invisible to the field.
    .filter((c) => !c.owner.banned);
}

/**
 * Live "ideas" — thoughts in the field. They don't expire and aren't "full";
 * an idea stays open until it transforms or is archived. Hottest resonance
 * first (most signals), then most recent.
 */
export async function fetchActiveIdeas(): Promise<Card[]> {
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_SELECT)
    .eq("kind", "idea")
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as unknown as CardRow[])
    .map(mapCard)
    // Banned owners are invisible to the field.
    .filter((c) => !c.owner.banned)
    .sort((a, b) =>
      b.signals.length - a.signals.length || b.createdAt - a.createdAt,
    );
}

/**
 * The whole live field: ideas + things, in one fetch. Convenience for the
 * home surface so it can lead with ideas and layer things on the map.
 */
export async function fetchField(): Promise<{ ideas: Card[]; things: Card[] }> {
  const [ideas, things] = await Promise.all([
    fetchActiveIdeas(),
    fetchActiveCards(),
  ]);
  return { ideas, things };
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

export async function fetchTrackRecord(userId: string): Promise<TrackEntry[]> {
  // Two queries in parallel: cards I created + cards I joined.
  const [{ data: created }, { data: joined }] = await Promise.all([
    supabase.from("cards").select(CARD_SELECT).eq("owner_id", userId),
    supabase
      .from("joiners")
      .select(`role, joined_at, card:cards(${CARD_SELECT})`)
      .eq("user_id", userId),
  ]);

  const entries: TrackEntry[] = [];

  for (const row of (created || []) as unknown as CardRow[]) {
    const card = mapCard(row);
    entries.push({ card, role: "CREATOR", at: card.createdAt, isCreator: true });
  }

  for (const row of (joined || []) as unknown as {
    role: string;
    joined_at: string;
    card: CardRow | null;
  }[]) {
    if (!row.card) continue;
    const card = mapCard(row.card);
    // Hide cards by banned creators from public track surfaces.
    if (card.owner.banned) continue;
    entries.push({
      card,
      role: (row.role || "JOINER").toUpperCase(),
      at: new Date(row.joined_at).getTime(),
      isCreator: false,
    });
  }

  return entries.sort((a, b) => b.at - a.at);
}
