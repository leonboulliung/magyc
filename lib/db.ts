import { supabase } from "./supabase";
import { sanitizeModules } from "./modules";
import type {
  Actor, Module, ModuleStateEntry, ModuleStateKind, Profile, Space, SpaceLabels, SpaceVersion, Vibe, Visibility,
} from "./types";
import { ALL_VIBES } from "./types";

// ============================================================
// Row → TS mapping
// ============================================================

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  color: string | null;
  created_at: string;
};

type ModuleStateRow = {
  id: string;
  space_id: string;
  module_index: number;
  actor_kind: "user" | "anon";
  actor_id: string;
  display_name: string | null;
  kind: string;
  data: Record<string, unknown> | null;
  created_at: string;
};

type SpaceRow = {
  id: string;
  input_text: string;
  title: string;
  language: string;
  vibe: string;
  modules: unknown[] | null;
  labels: Record<string, unknown> | null;
  anon_owner_token: string;
  owner_id: string | null;
  visibility: string | null;
  password_hash: string | null;
  created_at: string;
  published_at: string | null;
  owner: ProfileRow | null;
  state: ModuleStateRow[] | null;
  versions: SpaceVersionRow[] | null;
};

type SpaceVersionRow = {
  id: string;
  space_id: string;
  version: number;
  title: string;
  modules: unknown[] | null;
  note: string | null;
  created_at: string;
};

function mapProfile(row: ProfileRow | null, fallbackId = ""): Profile {
  if (!row) {
    return {
      id: fallbackId,
      displayName: fallbackId ? `user-${fallbackId.slice(-6)}` : "user",
      avatarUrl: null,
      color: null,
      createdAt: 0,
    };
  }
  return {
    id: row.id,
    displayName: row.display_name || `user-${row.id.slice(-6)}`,
    avatarUrl: row.avatar_url,
    color: row.color ?? null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
  };
}

const ALLOWED_STATE_KINDS = new Set<ModuleStateKind>([
  "vote", "check", "claim", "voice", "edit", "add", "upload", "stroke",
]);

function mapModuleStateEntry(row: ModuleStateRow): ModuleStateEntry {
  const actor: Actor = {
    kind: row.actor_kind === "anon" ? "anon" : "user",
    id: row.actor_id,
    displayName: row.display_name || undefined,
  };
  return {
    id: row.id,
    spaceId: row.space_id,
    moduleIndex: row.module_index,
    actor,
    kind: ALLOWED_STATE_KINDS.has(row.kind as ModuleStateKind)
      ? (row.kind as ModuleStateKind)
      : "voice",
    data: row.data ?? {},
    createdAt: new Date(row.created_at).getTime(),
  };
}

const VIBE_SET = new Set<string>(ALL_VIBES);

function mapVibe(raw: string): Vibe {
  return VIBE_SET.has(raw) ? (raw as Vibe) : "minimal";
}

function mapVisibility(raw: string | null): Visibility {
  if (raw === "public" || raw === "password") return raw;
  return null;
}

const LABEL_KEYS: readonly (keyof SpaceLabels)[] = [
  "publishCta", "publishTitle", "publishExplanation", "cancel",
  "publishConfirm", "signInPrompt", "signInCta", "signedInAs",
  "visibilityPublic", "visibilityPrivate", "copy", "copied",
  "backToCurrent", "viewingVersionPrefix",
  "emptyGrid", "emptyGridHint",
  "rendererPending",
];

function mapLabels(raw: Record<string, unknown> | null): SpaceLabels {
  const out: SpaceLabels = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of LABEL_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "string") {
      const cleaned = v.trim().slice(0, 200);
      if (cleaned) out[k] = cleaned;
    }
  }
  return out;
}

function mapSpaceVersion(row: SpaceVersionRow): SpaceVersion {
  return {
    id: row.id,
    spaceId: row.space_id,
    version: row.version,
    title: row.title || "",
    modules: sanitizeModules(row.modules ?? []),
    note: row.note,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapSpace(row: SpaceRow): Space {
  const modules: Module[] = sanitizeModules(row.modules ?? []);
  const state = (row.state || [])
    .map(mapModuleStateEntry)
    .sort((a, b) => a.moduleIndex - b.moduleIndex || a.createdAt - b.createdAt);
  const versions = (row.versions || [])
    .map(mapSpaceVersion)
    .sort((a, b) => a.version - b.version);
  return {
    id: row.id,
    inputText: row.input_text,
    title: row.title || "",
    language: row.language || "en",
    vibe: mapVibe(row.vibe),
    modules,
    labels: mapLabels(row.labels ?? null),
    anonOwnerTokenHint: !!row.anon_owner_token,
    owner: row.owner_id ? mapProfile(row.owner, row.owner_id) : null,
    visibility: mapVisibility(row.visibility),
    createdAt: new Date(row.created_at).getTime(),
    publishedAt: row.published_at ? new Date(row.published_at).getTime() : null,
    state,
    versions,
  };
}

const SPACE_SELECT = `
  id, input_text, title, language, vibe, modules, labels,
  anon_owner_token, owner_id, visibility, password_hash,
  created_at, published_at,
  owner:profiles!spaces_owner_id_fkey(id, display_name, avatar_url, color, created_at),
  state:module_state(id, space_id, module_index, actor_kind, actor_id, display_name, kind, data, created_at),
  versions:space_versions(id, space_id, version, title, modules, note, created_at)
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
