import { supabase } from "./supabase";
import { CONTRACT_VERSION } from "./contract";
import { sanitizeModules } from "./modules";
import { AI_LABEL_KEYS } from "./labels";
import { sanitizeStyle } from "./style";
import type {
  Actor, HandoffInfo, Module, ModuleStateEntry, ModuleStateKind, Profile, ProjectStage, Space, SpaceLabels, SpaceVersion, Vibe, Visibility,
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

/** Exported — the realtime channel receives raw module_state rows and
 *  maps them with mapStateRow below. */
export type ModuleStateRow = {
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
  contract_version?: string | null;
  modules_rev?: number | null;
  input_text: string;
  title: string;
  language: string;
  vibe: string;
  modules: unknown[] | null;
  labels: Record<string, unknown> | null;
  style: Record<string, unknown> | null;
  stage: string | null;
  segment: string | null;
  shared: boolean | null;
  archived_at: string | null;
  deleted_at: string | null;
  handoff: unknown;
  owner_id: string | null;
  visibility: string | null;
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
  // Not loaded by the space query (only by fetchVersionModules on demand)
  // — the list query stays light. Absent → mapped to [].
  modules?: unknown[] | null;
  note: string | null;
  created_at: string;
};

export interface SpaceListItem {
  id: string;
  title: string;
  stage: ProjectStage | null;
  segment: string | null;
  shared: boolean;
  archivedAt: number | null;
  deletedAt: number | null;
  createdAt: number;
}

type SpaceListRow = {
  id: string;
  title: string;
  stage: string | null;
  segment: string | null;
  shared: boolean | null;
  archived_at: string | null;
  deleted_at: string | null;
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

/** Map a raw module_state row (DB read or realtime payload) into the
 *  typed entry every renderer consumes. */
export function mapStateRow(row: ModuleStateRow): ModuleStateEntry {
  return mapModuleStateEntry(row);
}

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

export function mapHandoff(raw: unknown): HandoffInfo {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const note = typeof o.note === "string" ? o.note.slice(0, 2000) : "";
  const links = Array.isArray(o.links)
    ? o.links
        .map((l) => (l && typeof l === "object" ? l as Record<string, unknown> : {}))
        .map((l) => ({
          label: typeof l.label === "string" ? l.label.slice(0, 120) : "",
          url: typeof l.url === "string" ? l.url.slice(0, 600) : "",
        }))
        .filter((l) => l.url)
        .slice(0, 20)
    : [];
  return { note, links };
}

function mapLabels(raw: Record<string, unknown> | null): SpaceLabels {
  const out: SpaceLabels = {};
  if (!raw || typeof raw !== "object") return out;
  const strOut = out as Record<string, string>;
  for (const k of AI_LABEL_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "string") {
      const cleaned = v.trim().slice(0, 200);
      if (cleaned) strOut[k] = cleaned;
    }
  }
  // Emergent widget-picker labels — an untyped string map.
  const wl = (raw as Record<string, unknown>).widgetLabels;
  if (wl && typeof wl === "object") {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(wl as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) cleaned[k] = v.trim().slice(0, 40);
    }
    if (Object.keys(cleaned).length > 0) out.widgetLabels = cleaned;
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
    contractVersion: row.contract_version || CONTRACT_VERSION,
    modulesRev: typeof row.modules_rev === "number" ? row.modules_rev : 0,
    inputText: row.input_text,
    title: row.title || "",
    language: row.language || "en",
    vibe: mapVibe(row.vibe),
    stage: (row.stage === "brief" || row.stage === "production" || row.stage === "handoff")
      ? (row.stage as ProjectStage)
      : null,
    segment: row.segment ?? null,
    shared: row.shared === true,
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    handoff: mapHandoff(row.handoff ?? null),
    modules,
    labels: mapLabels(row.labels ?? null),
    style: sanitizeStyle(row.style ?? null),
    anonOwnerTokenHint: row.visibility === null,
    owner: row.owner_id ? mapProfile(row.owner, row.owner_id) : null,
    visibility: mapVisibility(row.visibility),
    createdAt: new Date(row.created_at).getTime(),
    publishedAt: row.published_at ? new Date(row.published_at).getTime() : null,
    state,
    versions,
  };
}

function mapSpaceListItem(row: SpaceListRow): SpaceListItem {
  return {
    id: row.id,
    title: row.title || "",
    stage: (row.stage === "brief" || row.stage === "production" || row.stage === "handoff")
      ? (row.stage as ProjectStage)
      : null,
    segment: row.segment ?? null,
    shared: row.shared === true,
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

const SPACE_SELECT = `
  id, contract_version, modules_rev, input_text, title, language, vibe, modules, labels, style,
  stage, segment, shared, archived_at, deleted_at,
  owner_id, visibility,
  created_at, published_at,
  owner:profiles!spaces_owner_id_fkey(id, display_name, avatar_url, color, created_at),
  state:module_state(id, space_id, module_index, actor_kind, actor_id, display_name, kind, data, created_at),
  versions:space_versions(id, space_id, version, title, note, created_at)
`;

const SPACE_SELECT_WITHOUT_CONTRACT = `
  id, modules_rev, input_text, title, language, vibe, modules, labels, style,
  stage, segment, shared, archived_at, deleted_at,
  owner_id, visibility,
  created_at, published_at,
  owner:profiles!spaces_owner_id_fkey(id, display_name, avatar_url, color, created_at),
  state:module_state(id, space_id, module_index, actor_kind, actor_id, display_name, kind, data, created_at),
  versions:space_versions(id, space_id, version, title, note, created_at)
`;

const SPACE_SELECT_LEGACY = `
  id, input_text, title, language, vibe, modules, labels, style,
  stage, segment, shared, archived_at, deleted_at,
  owner_id, visibility,
  created_at, published_at,
  owner:profiles!spaces_owner_id_fkey(id, display_name, avatar_url, color, created_at),
  state:module_state(id, space_id, module_index, actor_kind, actor_id, display_name, kind, data, created_at),
  versions:space_versions(id, space_id, version, title, note, created_at)
`;

function isMissingColumn(error: unknown, column: string): boolean {
  const e = error as { message?: string; details?: string; hint?: string; code?: string } | null;
  const text = [e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(" ").toLowerCase();
  return text.includes(column.toLowerCase());
}

// ============================================================
// Queries
// ============================================================

export async function fetchSpaceById(id: string): Promise<Space | null> {
  const primary = await supabase
    .from("spaces")
    .select(SPACE_SELECT)
    .eq("id", id)
    .maybeSingle();
  let data: unknown = primary.data;
  let error: unknown = primary.error;
  if (error && isMissingColumn(error, "contract_version")) {
    const fallback = await supabase
      .from("spaces")
      .select(SPACE_SELECT_WITHOUT_CONTRACT)
      .eq("id", id)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
  if (error && isMissingColumn(error, "modules_rev")) {
    const fallback = await supabase
      .from("spaces")
      .select(SPACE_SELECT_LEGACY)
      .eq("id", id)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return data ? mapSpace(data as unknown as SpaceRow) : null;
}

/**
 * Abschluss info, fetched on its own and tolerantly: the `handoff` column was
 * added in migration 016, so a deploy that lands before the migration must not
 * break — any error (incl. "column does not exist") falls back to empty. Kept
 * OUT of SPACE_SELECT so the main space read never depends on the new column.
 */
export async function fetchHandoff(id: string): Promise<HandoffInfo> {
  try {
    const { data, error } = await supabase
      .from("spaces")
      .select("handoff")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return { note: "", links: [] };
    return mapHandoff((data as { handoff?: unknown }).handoff);
  } catch {
    return { note: "", links: [] };
  }
}

/** Load ONE historical version's modules on demand — the space query no
 *  longer ships every version's full module set, so viewing history
 *  fetches just the snapshot being opened. */
export async function fetchVersionModules(spaceId: string, version: number): Promise<Module[] | null> {
  const { data, error } = await supabase
    .from("space_versions")
    .select("modules")
    .eq("space_id", spaceId)
    .eq("version", version)
    .maybeSingle();
  if (error || !data) return null;
  return sanitizeModules((data as { modules?: unknown[] | null }).modules ?? []);
}

export async function fetchSpacesByOwner(ownerId: string): Promise<Space[]> {
  const primary = await supabase
    .from("spaces")
    .select(SPACE_SELECT)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  let data: unknown = primary.data;
  let error: unknown = primary.error;
  if (error && isMissingColumn(error, "contract_version")) {
    const fallback = await supabase
      .from("spaces")
      .select(SPACE_SELECT_WITHOUT_CONTRACT)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }
  if (error && isMissingColumn(error, "modules_rev")) {
    const fallback = await supabase
      .from("spaces")
      .select(SPACE_SELECT_LEGACY)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return ((data || []) as unknown as SpaceRow[]).map(mapSpace);
}

export async function fetchSpaceListByOwner(ownerId: string): Promise<SpaceListItem[]> {
  const { data, error } = await supabase
    .from("spaces")
    .select("id, title, stage, segment, shared, archived_at, deleted_at, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as SpaceListRow[]).map(mapSpaceListItem);
}
