/**
 * v3 — types.
 *
 * A space is a workspace built from a list of typed modules. The AI
 * classifies the input, picks 3–7 module types from this registry,
 * and configures each. Module-level state (votes, ticks, claims, …)
 * lives in a separate `module_state` table and is keyed by space +
 * module index.
 */

export type Vibe =
  | "editorial"
  | "document"
  | "dashboard"
  | "terminal"
  | "soft"
  | "minimal";

export const ALL_VIBES: readonly Vibe[] = [
  "editorial",
  "document",
  "dashboard",
  "terminal",
  "soft",
  "minimal",
] as const;

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: number;
}

// ============================================================
// Modules (15 types) — discriminated union
// ============================================================

/** Per-module common fields. */
export interface ModuleBase {
  /** AI-generated, in the input's language. Replaces hard-coded titles. */
  label: string;
  /** AI-generated, 1 line of context. Optional. */
  description?: string;
  /** Source attribution where required (Wikipedia, OSM, …). */
  attribution?: { name: string; url: string; license: string };
}

// ----- Tier A — no data source -----

export interface HeadlineModule extends ModuleBase {
  type: "headline";
  /** The space's anchoring headline. May echo the AI-generated title or
   *  diverge — the headline lives on the module, not on the space row. */
  title: string;
  subtitle?: string;
}

/**
 * Synthesis — the AI's reflective paragraph after the input + answers.
 * Renders as prose (no card frame). Always second after the headline.
 * This is the "die App hat dich verstanden"-moment.
 */
export interface SynthesisModule extends ModuleBase {
  type: "synthesis";
  /** 2–4 sentences. AI-authored, in the input's language. */
  text: string;
}

export interface TagsModule extends ModuleBase {
  type: "tags";
  tags: string[];
}

export interface NotesModule extends ModuleBase {
  type: "notes";
  /** Initial seed text. Visitors can append via `edit` state. */
  text: string;
}

export interface OpenQuestionModule extends ModuleBase {
  type: "open_question";
  /** The question itself. Answers come in via `voice` state. */
  prompt: string;
}

export interface PollModule extends ModuleBase {
  type: "poll";
  question: string;
  options: string[];
}

export interface ChecklistModule extends ModuleBase {
  type: "checklist";
  items: { text: string }[];
}

export interface HelpSlotsModule extends ModuleBase {
  type: "help_slots";
  slots: { label: string }[];
}

export interface StagesModule extends ModuleBase {
  type: "stages";
  stages: string[];
  /** Initial pointer; can be advanced via `edit` state. */
  current: number;
}

export interface NumberBlockModule extends ModuleBase {
  type: "number_block";
  value: string;
  caption?: string;
}

// ----- Tier B — data-source-backed -----

export interface IconModule extends ModuleBase {
  type: "icon";
  /** Iconify set:name pair, e.g. "lucide:book-open". */
  iconify: string;
  size?: number;
}

export interface PaletteModule extends ModuleBase {
  type: "palette";
  /** Open Props hue token (e.g. "blue", "amber"). */
  hue: string;
  /** Which steps from the 0–12 scale to surface. */
  steps?: number[];
}

export interface MapModule extends ModuleBase {
  type: "map";
  /** [longitude, latitude] center. */
  center: [number, number];
  zoom: number;
  markers?: { lng: number; lat: number; label?: string }[];
}

export type TimeMode = "date" | "countdown" | "timeline";

export interface TimeModule extends ModuleBase {
  type: "time";
  mode: TimeMode;
  /** ISO 8601. For "timeline", the first entry. */
  date?: string;
  /** For "timeline" — multiple labeled dates. */
  entries?: { date: string; label: string }[];
  timezone?: string;
}

export interface KnowledgeModule extends ModuleBase {
  type: "knowledge";
  /** Wikipedia page title OR Wikidata Qid. */
  topic: string;
  source: "wikipedia" | "wikidata";
  /** Which facets to surface in the rendered card. */
  show: ("summary" | "thumb" | "facts")[];
}

// ----- Tier C — static framework, AI prefills -----

export type FrameworkKind =
  | "okr"
  | "scqa"
  | "eisenhower"
  | "rice"
  | "kanban"
  | "adr"
  | "rfc"
  | "postmortem"
  | "faq"
  | "one_pager";

export interface FrameworkModule extends ModuleBase {
  type: "framework";
  kind: FrameworkKind;
  /** Prefilled field values keyed by the framework's slot names.
   *  E.g. for OKR: { "objective": "…", "kr1": "…" }. */
  prefill: Record<string, string>;
}

// ----- Optional set (also shipped in v3.0, but rarely chosen) -----

export interface TypographyModule extends ModuleBase {
  type: "typography";
  heading: string; // Google Fonts family name
  body: string;
}

export interface FormulaModule extends ModuleBase {
  type: "formula";
  latex: string;
  display?: "inline" | "block";
}

export interface ChartModule extends ModuleBase {
  type: "chart";
  chartType: "bar" | "line" | "area";
  data: { x: string; y: number }[];
  xLabel?: string;
  yLabel?: string;
}

export interface ImageModule extends ModuleBase {
  type: "image";
  /** Wikimedia Commons file URL or thumbnail URL. */
  url: string;
  alt?: string;
}

// ----- The union -----

export type Module =
  | HeadlineModule
  | SynthesisModule
  | TagsModule
  | NotesModule
  | OpenQuestionModule
  | PollModule
  | ChecklistModule
  | HelpSlotsModule
  | StagesModule
  | NumberBlockModule
  | IconModule
  | PaletteModule
  | MapModule
  | TimeModule
  | KnowledgeModule
  | FrameworkModule
  | TypographyModule
  | FormulaModule
  | ChartModule
  | ImageModule;

export type ModuleType = Module["type"];

export const ALL_MODULE_TYPES: readonly ModuleType[] = [
  "headline",
  "synthesis",
  "tags",
  "notes",
  "open_question",
  "poll",
  "checklist",
  "help_slots",
  "stages",
  "number_block",
  "icon",
  "palette",
  "map",
  "time",
  "knowledge",
  "framework",
  "typography",
  "formula",
  "chart",
  "image",
] as const;

// ============================================================
// Module state — collaborative actions
// ============================================================

export type ActorKind = "user" | "anon";

export interface Actor {
  kind: ActorKind;
  id: string;
  displayName?: string;
}

export type ModuleStateKind =
  | "vote"   // poll → { option: string }
  | "check"  // checklist → { itemIndex: number; checked: boolean }
  | "claim"  // help_slots → { slotLabel: string }
  | "voice"  // open_question → { text: string }
  | "edit"   // notes / stages → { text?: string; current?: number }
  | "add";   // tags / checklist → { value: string }

export interface ModuleStateEntry {
  id: string;
  spaceId: string;
  moduleIndex: number;
  actor: Actor;
  kind: ModuleStateKind;
  data: Record<string, unknown>;
  createdAt: number;
}

// ============================================================
// Space
// ============================================================

export type Visibility = "public" | "password" | null;

/** A single point-in-time snapshot of a space's modules. v1 is created
 *  at publish; further saved edits create v2, v3, … */
export interface SpaceVersion {
  id: string;
  spaceId: string;
  version: number;
  title: string;
  modules: Module[];
  note: string | null;
  createdAt: number;
}

export interface Space {
  id: string;
  inputText: string;
  title: string;
  language: string;
  vibe: Vibe;
  modules: Module[];
  /** Set at creation; the creator's browser holds the matching token. */
  anonOwnerTokenHint: boolean; // server returns true if the row has one; never returns the token itself
  owner: Profile | null;
  visibility: Visibility;
  createdAt: number;
  publishedAt: number | null;
  /** All collaborative state entries for this space, sorted by index then time. */
  state: ModuleStateEntry[];
  /** Published versions, oldest first. Empty array on drafts. */
  versions: SpaceVersion[];
}
