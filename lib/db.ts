import { supabase } from "./supabase";
import type {
  Contribution, ContributionData, Primitive, Profile, Space,
} from "./types";
import { ALLOWED_PRIMITIVE_TYPES } from "./types";

// ============================================================
// Row → TS mapping
// ============================================================

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

type ContributionRow = {
  id: string;
  space_id: string;
  primitive_index: number;
  user_id: string;
  kind: string;
  data: Record<string, unknown> | null;
  created_at: string;
  user: ProfileRow | null;
};

type SpaceRow = {
  id: string;
  owner_id: string;
  input_text: string;
  title: string;
  language: string;
  primitives: unknown[] | null;
  created_at: string;
  owner: ProfileRow | null;
  contributions: ContributionRow[] | null;
};

function blankProfile(id: string): Profile {
  return {
    id,
    displayName: `user-${id.slice(-6) || "0000"}`,
    avatarUrl: null,
    createdAt: 0,
  };
}

function mapProfile(row: ProfileRow | null, fallbackId = ""): Profile {
  if (!row) return blankProfile(fallbackId);
  return {
    id: row.id,
    displayName: row.display_name || `user-${row.id.slice(-6)}`,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
  };
}

const ALLOWED_PRIM_SET = new Set<string>(ALLOWED_PRIMITIVE_TYPES);

/**
 * JSONB → Primitive[]. Shape-validate each entry; drop anything that
 * doesn't fit a known primitive type. Keeps the UI free of null-guards.
 */
function mapPrimitives(raw: unknown[] | null): Primitive[] {
  if (!Array.isArray(raw)) return [];
  const out: Primitive[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.type !== "string" || !ALLOWED_PRIM_SET.has(rec.type)) continue;

    switch (rec.type) {
      case "brief": {
        if (typeof rec.text === "string") {
          const t = rec.text.trim().slice(0, 240);
          if (t) out.push({ type: "brief", text: t });
        }
        break;
      }
      case "open_questions": {
        if (Array.isArray(rec.questions)) {
          const qs: string[] = [];
          for (const q of rec.questions) {
            if (typeof q === "string") {
              const v = q.trim().slice(0, 160);
              if (v) qs.push(v);
            }
            if (qs.length >= 5) break;
          }
          if (qs.length > 0) out.push({ type: "open_questions", questions: qs });
        }
        break;
      }
      case "help_needed": {
        if (Array.isArray(rec.asks)) {
          const asks: string[] = [];
          for (const a of rec.asks) {
            if (typeof a === "string") {
              const v = a.trim().slice(0, 80);
              if (v) asks.push(v);
            }
            if (asks.length >= 5) break;
          }
          if (asks.length > 0) out.push({ type: "help_needed", asks });
        }
        break;
      }
      case "voices": {
        out.push({ type: "voices" });
        break;
      }
      case "resources": {
        // Stored resources can carry items added by visitors, but the
        // composer always emits []. We keep the items shape just in case
        // a later migration starts storing them on the primitive itself
        // — today, contributions of kind 'resource' carry the data.
        const items: { url: string; caption?: string }[] = [];
        if (Array.isArray(rec.items)) {
          for (const r of rec.items) {
            if (!r || typeof r !== "object") continue;
            const rr = r as Record<string, unknown>;
            if (typeof rr.url !== "string") continue;
            const u = rr.url.trim();
            if (!/^https?:\/\/[^\s]+$/i.test(u)) continue;
            const c = typeof rr.caption === "string"
              ? rr.caption.trim().slice(0, 120)
              : undefined;
            items.push(c ? { url: u, caption: c } : { url: u });
            if (items.length >= 24) break;
          }
        }
        out.push({ type: "resources", items });
        break;
      }
      case "next_steps": {
        if (Array.isArray(rec.steps)) {
          const steps: string[] = [];
          for (const s of rec.steps) {
            if (typeof s === "string") {
              const v = s.trim().slice(0, 120);
              if (v) steps.push(v);
            }
            if (steps.length >= 6) break;
          }
          out.push({ type: "next_steps", steps });
        }
        break;
      }
      case "place": {
        if (typeof rec.label === "string") {
          const v = rec.label.trim().slice(0, 80);
          if (v) out.push({ type: "place", label: v });
        }
        break;
      }
    }
  }
  return out;
}

function mapContributionData(kind: string, raw: Record<string, unknown> | null): ContributionData {
  const r = raw || {};
  switch (kind) {
    case "voice":
      return {
        kind: "voice",
        text: typeof r.text === "string" ? r.text : "",
      };
    case "claim":
      return {
        kind: "claim",
        ask: typeof r.ask === "string" ? r.ask : "",
      };
    case "resource":
      return {
        kind: "resource",
        url: typeof r.url === "string" ? r.url : "",
        caption: typeof r.caption === "string" ? r.caption : undefined,
      };
    default:
      return { kind: "voice", text: "" };
  }
}

function mapContribution(row: ContributionRow): Contribution {
  return {
    id: row.id,
    spaceId: row.space_id,
    primitiveIndex: row.primitive_index,
    userId: row.user_id,
    user: mapProfile(row.user, row.user_id),
    kind: (["voice", "claim", "resource"] as const).includes(row.kind as never)
      ? (row.kind as "voice" | "claim" | "resource")
      : "voice",
    data: mapContributionData(row.kind, row.data ?? null),
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    ownerId: row.owner_id,
    owner: mapProfile(row.owner, row.owner_id),
    inputText: row.input_text,
    title: row.title || "",
    language: row.language || "en",
    primitives: mapPrimitives(row.primitives ?? null),
    contributions: (row.contributions || []).map(mapContribution),
    createdAt: new Date(row.created_at).getTime(),
  };
}

const SPACE_SELECT = `
  id, owner_id, input_text, title, language, primitives, created_at,
  owner:profiles!spaces_owner_id_fkey(id, display_name, avatar_url, created_at),
  contributions:contributions(id, space_id, primitive_index, user_id, kind, data, created_at,
    user:profiles!contributions_user_id_fkey(id, display_name, avatar_url, created_at)
  )
`;

// ============================================================
// Queries
// ============================================================

export async function fetchSpaceById(id: string): Promise<Space | null> {
  const { data, error } = await supabase
    .from("spaces")
    .select(SPACE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSpace(data as unknown as SpaceRow) : null;
}

export async function fetchSpacesByOwner(ownerId: string): Promise<Space[]> {
  const { data, error } = await supabase
    .from("spaces")
    .select(SPACE_SELECT)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as unknown as SpaceRow[]).map(mapSpace);
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as unknown as ProfileRow) : null;
}
