/**
 * v4 — types.
 *
 * A space is a workspace built from a sequence of typed widgets. There
 * are 31 widget kinds in the registry (3 header-zone, 28 body). The
 * agent classifies the user's input, picks which widgets fit, and
 * configures each.
 *
 * The application has NO own language: every visible string on a widget
 * is either AI-generated in the user's language (the optional
 * `microTitle` field) or user-entered. The `type` discriminator and
 * everything in this file is internal identifier only — never shown.
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
  /** Personal accent color used by Sketch strokes and Checklist
   *  attribution dots. AI-assigned at first sign-in. */
  color: string | null;
  createdAt: number;
}

// ============================================================
// Widget union
//
// Every widget has an optional `microTitle` (AI-generated in user's
// language) and optional `description`. Source attribution is carried
// in `attribution` where the widget pulls from a license-bearing
// external source.
// ============================================================

export interface WidgetBase {
  /** AI-generated small label in the user's language. Most widgets
   *  show this above the content; some (icon, gif) ignore it. */
  microTitle?: string;
  /** Optional 1-line context line. */
  description?: string;
  /** When the widget pulls from a CC-BY / OSM / Wikipedia-style
   *  source, the attribution travels with it. */
  attribution?: { name: string; url: string; license: string };
}

// ----- Header zone — always inserted -----

/**
 * Heading. The space's title. H1–H6 sizing the user controls. When
 * empty, the placeholder (AI-supplied) reflects the prompt.
 */
export interface HeadingWidget extends WidgetBase {
  type: "heading";
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  placeholder?: string;
}

/**
 * Rich Text — body prose. The microTitle here is the small AI-set
 * heading ("Kontext", "Hintergrund", "Wunsch", …) in the user's
 * language.
 */
export interface RichTextWidget extends WidgetBase {
  type: "rich_text";
  text: string;
  placeholder?: string;
}

/** Tags chips. AI seeds; users add/remove. */
export interface TagsWidget extends WidgetBase {
  type: "tags";
  tags: string[];
}

// ----- Wiki + AI reference cards -----

/**
 * Wikipedia-Einordnung. Agent provides a topic query; backend resolves
 * via OpenSearch into an exact article title + summary + thumbnail.
 * Edit cycles through 2 alternative articles or accepts a pasted URL.
 */
export interface WikipediaWidget extends WidgetBase {
  type: "wikipedia";
  /** Search query the agent settled on. */
  topic: string;
  /** Resolved article URL (filled by backend). */
  url?: string;
  /** Hero image, if Wikipedia returns one. */
  thumbnailUrl?: string;
  /** Extract — short summary, in en.wiki text or matched language wiki. */
  extract?: string;
}

/**
 * Ki-Einordnung — a generalised AI take that abstracts the input into
 * something useful. Renders with an ✦ symbol. Edit cycles 4 fresh
 * alternatives or accepts a pasted prompt.
 */
export interface AISummaryWidget extends WidgetBase {
  type: "ai_summary";
  text: string;
}

// ----- Icon -----

/** Single SVG icon. Edit reveals 6 candidates + a "new 5" regenerate. */
export interface IconWidget extends WidgetBase {
  type: "icon";
  /** Iconify set:name identifier (e.g. "lucide:video"). */
  iconify: string;
}

// ----- Map family — all four require mandatory pre-creation config -----

export interface LocationSingleWidget extends WidgetBase {
  type: "location_single";
  center: [number, number]; // [lng, lat]
  zoom?: number;
  label?: string;
}

export interface LocationsMultiWidget extends WidgetBase {
  type: "locations_multi";
  locations: { lng: number; lat: number; label?: string }[];
}

/**
 * Location-Vorschläge — proposed places presented as a TEXT list (no
 * visible map), with a signal/vote-style stacking of profile dots.
 */
export interface LocationSuggestionsWidget extends WidgetBase {
  type: "location_suggestions";
  suggestions: { label: string; address?: string; lng?: number; lat?: number }[];
}

/**
 * Route — multi-stop journey rendered on a map.
 */
export interface RouteWidget extends WidgetBase {
  type: "route";
  stops: { lng: number; lat: number; label?: string }[];
}

// ----- Time family -----

/** Datum — a specific day, no time-of-day. */
export interface DateWidget extends WidgetBase {
  type: "date";
  /** ISO date YYYY-MM-DD. */
  date: string;
}

/** Ein Termin — single date + time. */
export interface AppointmentWidget extends WidgetBase {
  type: "appointment";
  /** ISO 8601 datetime. */
  datetime: string;
  timezone?: string;
}

/** Mehrere Termine — list of date+time entries with optional labels. */
export interface AppointmentsWidget extends WidgetBase {
  type: "appointments";
  entries: { datetime: string; label?: string }[];
}

/**
 * Von - Bis — a generic span between two parameters. The `unit` hints
 * at the renderer's icon: clock for time-of-day, calendar for
 * weekdays / months / years / dates, no-icon for places / quantities.
 */
export interface RangeWidget extends WidgetBase {
  type: "range";
  unit: "time" | "weekday" | "month" | "year" | "date" | "place" | "amount" | "generic";
  from: string;
  to: string;
}

// ----- Team / packages -----

/**
 * Crew — roles a team can fill. Members live in module_state with a
 * `claim` action carrying the role label. Widget also supports a
 * segment-share affordance (invite to a specific role).
 */
export interface CrewWidget extends WidgetBase {
  type: "crew";
  roles: { name: string }[];
}

/**
 * Arbeitspakete — work packages, Apple-Wallet-style stacked cards. Each
 * package has assignable participants via module_state claims. Same
 * segment-share affordance as Crew.
 */
export interface WorkPackagesWidget extends WidgetBase {
  type: "work_packages";
  packages: { label: string; description?: string }[];
}

export type DeliverableStatus = "planned" | "in_progress" | "ready" | "delivered";
export type ApprovalAudience = "client" | "internal";
export type ApprovalStatus = "pending" | "requested" | "approved";

/**
 * Deliverables — the concrete outputs a project should produce, with
 * optional format / quantity / due hints for expectation-setting.
 */
export interface DeliverablesWidget extends WidgetBase {
  type: "deliverables";
  items: {
    label: string;
    details?: string;
    quantity?: string;
    format?: string;
    due?: string;
    status?: DeliverableStatus;
  }[];
}

/**
 * Approvals — named checkpoints collaborators can mark approved via
 * `check` actions. Same state primitive as Checklist, different intent.
 */
export interface ApprovalsWidget extends WidgetBase {
  type: "approvals";
  items: {
    text: string;
    description?: string;
    due?: string;
    audience?: ApprovalAudience;
    status?: ApprovalStatus;
  }[];
}

// ----- Free-form collaboration -----

/**
 * Notes — Apple-Wallet-style stack of editable note cards. Notes
 * themselves live in module_state with an `add` action; rearranging
 * is a state edit. Placeholder reflects the prompt when no notes yet.
 */
export interface NotesWidget extends WidgetBase {
  type: "notes";
  placeholder?: string;
}

/**
 * Fragen und Antworten — Q&A list. Can seed starting questions on the
 * widget config; questions and answers themselves live in module_state
 * with `voice` actions.
 */
export interface QAWidget extends WidgetBase {
  type: "qa";
  placeholder?: string;
  questions?: { text: string; answerHint?: string }[];
}

/** Umfrage. Single question with multiple-choice options. Votes via
 *  module_state. */
export interface PollWidget extends WidgetBase {
  type: "poll";
  question: string;
  options: string[];
}

/**
 * Diskussion — chronological thread. Messages, reply-to, and
 * comment-on-comment all flow through module_state voice actions
 * with an optional `parentId` in the data blob.
 */
export interface DiscussionWidget extends WidgetBase {
  type: "discussion";
  placeholder?: string;
}

// ----- Visualisation -----

/** Phasen — chronological phases. Mandatory config: agent needs to
 *  know which phases the user actually means. */
export interface PhasesWidget extends WidgetBase {
  type: "phases";
  phases: { label: string; description?: string }[];
  currentPhase: number;
}

/**
 * Checkliste — infinite-scroll checkable list. Checks live in
 * module_state; the renderer shows the checker's avatar in the
 * checked box.
 */
export interface ChecklistWidget extends WidgetBase {
  type: "checklist";
  items: { text: string }[];
}

// ----- Uploads — all back onto Supabase Storage -----

export interface AttachmentsWidget extends WidgetBase {
  type: "attachments";
  placeholder?: string;
}

export interface ImagesWidget extends WidgetBase {
  type: "images";
  placeholder?: string;
}

export interface AudioWidget extends WidgetBase {
  type: "audio";
  placeholder?: string;
}

// ----- Specialty -----

/**
 * Sketch — full-screen canvas. Strokes stored in module_state as path
 * data, coloured per author by Profile.color.
 */
export interface SketchWidget extends WidgetBase {
  type: "sketch";
  placeholder?: string;
}

/** Tabelle — generic comparison table. Static here; edits replace the
 *  whole grid. */
export interface TableWidget extends WidgetBase {
  type: "table";
  columns: string[];
  rows: string[][];
}

/** Utensilien — parts list / BOM with image and name per item. */
export interface PartsListWidget extends WidgetBase {
  type: "parts_list";
  items: { name: string; quantity?: string; imageUrl?: string }[];
}

/** GIF — a single GIF from Tenor/Giphy via backend proxy. */
export interface GifWidget extends WidgetBase {
  type: "gif";
  gifUrl: string;
  thumbnailUrl?: string;
}

// ----- The union -----

export type Module =
  | HeadingWidget
  | RichTextWidget
  | TagsWidget
  | WikipediaWidget
  | AISummaryWidget
  | IconWidget
  | LocationSingleWidget
  | LocationsMultiWidget
  | LocationSuggestionsWidget
  | RouteWidget
  | DateWidget
  | AppointmentWidget
  | AppointmentsWidget
  | RangeWidget
  | CrewWidget
  | WorkPackagesWidget
  | DeliverablesWidget
  | ApprovalsWidget
  | NotesWidget
  | QAWidget
  | PollWidget
  | DiscussionWidget
  | PhasesWidget
  | ChecklistWidget
  | AttachmentsWidget
  | ImagesWidget
  | AudioWidget
  | SketchWidget
  | TableWidget
  | PartsListWidget
  | GifWidget;

export type ModuleType = Module["type"];

export const ALL_MODULE_TYPES: readonly ModuleType[] = [
  // Header zone (always present)
  "heading",
  "rich_text",
  "tags",
  // Body widgets (28)
  "wikipedia",
  "ai_summary",
  "icon",
  "location_single",
  "locations_multi",
  "location_suggestions",
  "route",
  "date",
  "appointment",
  "appointments",
  "range",
  "crew",
  "work_packages",
  "deliverables",
  "approvals",
  "notes",
  "qa",
  "poll",
  "discussion",
  "phases",
  "checklist",
  "attachments",
  "images",
  "audio",
  "sketch",
  "table",
  "parts_list",
  "gif",
] as const;

/** Widgets that always appear in the header zone. */
export const HEADER_ZONE_TYPES: readonly ModuleType[] = [
  "heading",
  "rich_text",
  "tags",
] as const;

// ============================================================
// Clarify steps — the modalities of the clarify flow
//
// A clarify run returns an ordered list of typed steps. The MODALITY
// is the discriminator (`kind`), exactly mirroring how the classifier
// picks Module types. The AI chooses which modality fits each step;
// nothing is hardcoded. Adding a new modality = one more union member
// + one more renderer branch, never a special case threaded through
// the stage machine.
//
//   choice  — multiple-choice chips (+ implicit custom-text fallback).
//             The default: an enumerable answer space, the point is to
//             disambiguate.
//   text    — open free-text. Used ONLY when chips would distort an
//             open, generative answer (a mission line, naming a thing,
//             the core in one sentence). Rare and high-value.
//   module  — a precision-sensitive Module pulled forward for
//             interactive pre-configuration (map pin, phases, date).
// ============================================================

export interface ClarifyStepBase {
  /** Stable per-run id: s1, s2, … Used as the answer/config key. */
  id: string;
}

/**
 * Multiple-choice question. Chips, each a short label. The frontend
 * always appends an implicit custom-text option — the AI does not
 * generate it.
 */
export interface ClarifyChoiceStep extends ClarifyStepBase {
  kind: "choice";
  /** Secondary semantic tag — only drives the a11y marker, not layout.
   *  "data" = answers a mandatory-config widget; "general" = intent. */
  category?: "general" | "data";
  text: string;
  options: { value: string }[];
}

/**
 * Open free-text question. No chips — the answer is meant to be prose.
 * Reach for this only when offering options would lead or reduce the
 * answer (e.g. "Describe the mission in one sentence").
 */
export interface ClarifyTextStep extends ClarifyStepBase {
  kind: "text";
  text: string;
  /** Optional hint shown in the field, in the user's language. */
  placeholder?: string;
  /** Soft cap; frontend enforces. Defaults applied at render. */
  maxLength?: number;
}

/**
 * Module pre-configuration — a module the agentic AI judged important
 * and precision-sensitive enough to have the user configure UP FRONT,
 * rather than letting the author stage guess it.
 *
 * This is a GENERAL mechanism, not a map special case: any module type
 * that has a clarify-editor can be pulled forward. The map is just the
 * most valuable case (an LLM can't place a pin precisely), the science
 * example is `phases` (walk the process through before building), and
 * the same applies to dates, polls, and more as editors are added.
 *
 * `draft` is the AI's starting guess (loose shape — each editor reads
 * what it needs). The editor turns it into a real, valid Module that
 * flows into the build pre-confirmed.
 */
export interface ClarifyPrefill extends ClarifyStepBase {
  kind: "module";
  type: ModuleType;
  /** One short line: why this is worth configuring now (in the user's language). */
  reason: string;
  /** The AI's starting draft — interpreted by the type's editor. */
  draft: Record<string, unknown>;
}

/** The discriminated union of clarify modalities. */
export type ClarifyStep = ClarifyChoiceStep | ClarifyTextStep | ClarifyPrefill;

export type ClarifyStepKind = ClarifyStep["kind"];

// ============================================================
// Module state — collaborative actions
// ============================================================

export type ActorKind = "user" | "anon";

export interface Actor {
  kind: ActorKind;
  id: string;
  displayName?: string;
  /** Carried so the renderer can color a sketch stroke or fill a
   *  checked-box without re-fetching the profile. */
  color?: string;
}

export type ModuleStateKind =
  | "vote"   // poll, location_suggestions
  | "check"  // checklist
  | "claim"  // crew role, work_packages
  | "voice"  // discussion, qa
  | "edit"   // notes content, stages position, table cells, …
  | "add"    // tags, checklist items, work packages, notes, …
  | "upload" // attachments, images, audio
  | "stroke"; // sketch

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
// Space + versions
// ============================================================

export interface SpaceVersion {
  id: string;
  spaceId: string;
  version: number;
  title: string;
  modules: Module[];
  note: string | null;
  createdAt: number;
}

export type Visibility = "public" | "password" | null;

/**
 * Surface labels — the words the UI shows on a space.
 *
 * Every entry is OPTIONAL. The classifier fills as many as it can in
 * the user's language during space creation. Components read each
 * field defensively and fall back to a Unicode symbol or a minimal
 * English fragment if missing — so a partial labels object never
 * leaves the UI broken.
 *
 * The principle: this app has no system language. Nothing visible
 * on a space comes from a hardcoded i18n bundle; it all derives
 * from the user's input via the AI pass.
 */
export interface SpaceLabels {
  // Publish flow
  publishCta?: string;            // "publish →"
  publishTitle?: string;          // modal heading
  publishExplanation?: string;    // longer description
  cancel?: string;
  publishConfirm?: string;        // confirm button label
  signInPrompt?: string;          // why sign-in is required
  signInCta?: string;
  signedInAs?: string;            // "logged in as"

  // Privacy footer
  visibilityPublic?: string;
  visibilityPrivate?: string;
  copy?: string;
  copied?: string;

  // Version banner
  backToCurrent?: string;
  viewingVersionPrefix?: string;

  // Empty grid hint
  emptyGrid?: string;
  emptyGridHint?: string;

  // Participants strip
  participants?: string;          // "people" / "Beteiligte" — heading for the contributors strip

  // Placeholder for unbuilt renderers (temporary, removed after Phase 1+)
  rendererPending?: string;

  /** Emergent per-space labels for the widget picker, keyed by module
   *  type. AI-generated in the space language so the picker has no
   *  static system language. Falls back to a built-in table, then to a
   *  universal symbol. */
  widgetLabels?: Record<string, string>;
}

/**
 * Per-space visual style. Auto-assigned by the AI at creation to match
 * the input's mood, then freely editable by the owner. Overrides the
 * vibe tokens when present.
 *
 *   font        — a Google Fonts family name (loaded dynamically).
 *   color1      — primary ink: text, borders, map pins.
 *   color2      — accent: widget highlights, map fills/routes.
 *   background  — the page canvas behind the content. The element grid
 *                 itself stays white with a black dot pattern regardless.
 */
export interface SpaceStyle {
  font: string;
  color1: string;
  color2: string;
  background: string;
}

/** Creator-Suite project lifecycle stage. Null for anonymous spaces. */
export type ProjectStage = "brief" | "production" | "handoff";

export interface Space {
  id: string;
  inputText: string;
  title: string;
  language: string;
  vibe: Vibe;
  /** Creator-Suite lifecycle stage (null = anonymous space, not a project). */
  stage: ProjectStage | null;
  /** Which guided preset a suite project was built from (null otherwise). */
  segment: string | null;
  /** Suite project shared via unlisted link? (false = owner-only). Only
   *  meaningful for suite projects; anonymous/published spaces ignore it. */
  shared: boolean;
  modules: Module[];
  /** AI-generated UI labels in `language`. May be sparsely filled;
   *  renderers fall back to symbols. */
  labels: SpaceLabels;
  /** Per-space visual style (font + colors). Null until assigned. */
  style: SpaceStyle | null;
  anonOwnerTokenHint: boolean;
  owner: Profile | null;
  visibility: Visibility;
  createdAt: number;
  publishedAt: number | null;
  state: ModuleStateEntry[];
  versions: SpaceVersion[];
}
