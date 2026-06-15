import OpenAI from "openai";
import { MODULE_META, sanitizeModules } from "@/lib/modules";
import { ALL_VIBES, type Module, type ModuleType, type SpaceLabels, type SpaceStyle, type Vibe } from "@/lib/types";
import { FONT_NAMES } from "@/lib/fonts";
import { sanitizeStyle } from "@/lib/style";
import { AI_LABEL_KEYS } from "@/lib/labels";
import { resolveGeocoding } from "@/lib/server/geocode";
import {
  projectContextLines,
  projectModeAuthoringGuide,
  projectModeScoreBias,
  projectModeShapeHints,
} from "@/lib/projectModes";

/**
 * Classifier v5 — two-stage scoring architecture.
 *
 * v4 used a single call that both SELECTED and AUTHORED 26 widgets.
 * That suffered three structural problems:
 *   (a) position bias — modules late in the flat list got under-picked;
 *   (b) vague-rule modules (notes, discussion, qa) dominated every
 *       space regardless of fit;
 *   (c) the model defaulted to the same "safe" few each time.
 *
 * v5 separates the two jobs so each is done well:
 *
 *   Stage A — analyze():
 *     detects language + title + vibe, and SCORES every body module
 *     0-10 independently. Because the model must emit a number for
 *     EVERY module, none are forgotten at the tail of a list, and it
 *     is explicitly told that low scores are the norm — only tools
 *     that clearly serve THIS input score high.
 *
 *   selectModuleTypes():
 *     deterministic, server-side selection from the scores. The model
 *     never decides the final set — the server does, applying a
 *     minimum-score threshold, redundancy caps (max one date widget),
 *     and an overall cap. This is what removes the bias entirely:
 *     selection is a pure function of independent scores.
 *
 *   Stage B — author():
 *     given the chosen types + the detected language, generates the
 *     header (rich_text, tags), each body config, and the labels.
 *     Language is passed as a hard constraint, repeated, so an English
 *     input never yields a German page.
 *
 * Coordinate map widgets (location_single, locations_multi, route) and
 * gif are NOT AI-authored — they need geocoding / a real media URL the
 * model cannot invent. They remain available via the manual picker.
 * Place needs are served by location_suggestions (a text+vote list).
 */

// ── The body widgets the AI is allowed to author ──────────────────────
// Grouped by function for the scoring prompt so the model sees semantic
// structure instead of a flat registry list.
const SCORING_GROUPS: { title: string; types: ModuleType[] }[] = [
  { title: "REFERENCE & FRAMING", types: ["ai_summary", "wikipedia"] },
  { title: "TIME & SEQUENCE", types: ["date", "appointment", "appointments", "range", "phases"] },
  { title: "PLACE", types: ["location_single", "locations_multi", "location_suggestions", "route"] },
  { title: "PEOPLE & WORK", types: ["crew", "work_packages", "checklist"] },
  { title: "DISCUSSION & DECISIONS", types: ["notes", "qa", "poll", "discussion"] },
  { title: "STRUCTURED DATA", types: ["table", "parts_list"] },
  { title: "MEDIA", types: ["attachments", "images", "audio", "sketch"] },
];

const AI_SCORABLE_TYPES: ModuleType[] = SCORING_GROUPS.flatMap((g) => g.types);

// Redundancy groups — at most one widget from each per space.
const DATE_GROUP: ReadonlySet<ModuleType> = new Set(["date", "appointment", "appointments"]);
const PLACE_GROUP: ReadonlySet<ModuleType> = new Set([
  "location_single", "locations_multi", "location_suggestions", "route",
]);

// Selection tuning. The scorer is prompted to be strict, so the
// threshold must not be: MIN_SCORE 5 + MIN_BODY 2 produced bare
// 2-widget pages for rich inputs (see docs/BACKLOG.md #6).
const MIN_SCORE = 4;     // a module must score at least this to be considered
const MAX_BODY = 6;      // never more than this many body widgets
const MIN_BODY = 3;      // try to land at least this many so a page isn't bare

// ── Stage A: analyze + score ──────────────────────────────────────────

interface AnalyzeResult {
  language: string;
  title: string;
  vibe: Vibe;
  scores: Record<string, number>;
}

function buildScoringCatalog(): string {
  return SCORING_GROUPS.map((group) => {
    const lines = group.types
      .map((t) => `    - ${t}: ${MODULE_META[t].relevantWhen}`)
      .join("\n");
    return `  ${group.title}\n${lines}`;
  }).join("\n\n");
}

function buildAnalyzeSystemPrompt(): string {
  const catalog = buildScoringCatalog();
  const typeList = AI_SCORABLE_TYPES.join(", ");

  return `You are the analysis stage of a workspace composer. You receive a
short input the user wrote (an idea, wish, plan, concern) and you do
exactly two things:

1. DETECT the language of the input and a few framing facts.
2. SCORE how well each available widget fits THIS SPECIFIC input.

If UI CONTEXT is provided, use it to tailor scoring and structure. It
represents an explicit project type the user selected in the interface.
Do NOT let English UI context override the language of the USER INPUT.

Return STRICT JSON, no preamble:

{
  "language": "<ISO 639-1 code of the INPUT's language>",
  "title": "<3-8 word headline in the input's language>",
  "vibe": "<editorial | document | dashboard | terminal | soft | minimal>",
  "scores": {
    "<every widget type below>": <integer 0-10>
  }
}

SCORING RULES — read carefully, this is the important part:
- Output a score for EVERY widget type listed below. All ${AI_SCORABLE_TYPES.length}
  must be present as keys. A missing key is an error.
- Score each widget INDEPENDENTLY against the input. A widget's
  position in this list is irrelevant — judge it on its own merit.
- Most widgets should score LOW (0-3) for any given input. That is
  correct and expected. A typical input is genuinely served by only
  3-5 widgets. Do NOT spread mediocre scores to be "helpful".
- Reserve 8-10 for widgets that obviously and concretely serve THIS
  input. Reserve 5-7 for plausible fits. Score 0-4 for everything
  that would only fit a generic version of the input.
- Be especially strict with discussion, notes, qa, poll — only score
  them high when the input GENUINELY needs that exact interaction,
  not just because most projects "could" have a discussion.

THE WIDGETS:

${catalog}

The complete set of keys your "scores" object must contain:
${typeList}

Output ONLY the JSON object.`;
}

export interface ClassifyContext {
  projectMode?: unknown;
}

function buildAnalyzeUserMessage(
  input: string,
  answers: ClassifyAnswer[],
  context: ClassifyContext = {},
): string {
  const lines: string[] = ["INPUT:", input.trim()];
  const contextLines = projectContextLines(context.projectMode);
  if (contextLines.length > 0) {
    lines.push("", "UI CONTEXT:", ...contextLines);
  }
  if (answers.length > 0) {
    lines.push("", "CLARIFICATIONS (the user answered these):");
    for (const a of answers) lines.push(`- ${a.questionText.trim()} → ${a.choice.trim()}`);
  }
  return lines.join("\n");
}

function applyProjectModeScoreBias(
  scores: Record<string, number>,
  context: ClassifyContext,
): Record<string, number> {
  const bias = projectModeScoreBias(context.projectMode);
  if (Object.keys(bias).length === 0) return scores;
  const adjusted: Record<string, number> = { ...scores };
  for (const type of AI_SCORABLE_TYPES) {
    const delta = bias[type] ?? 0;
    if (!delta) continue;
    adjusted[type] = Math.max(0, Math.min(10, (adjusted[type] ?? 0) + delta));
  }
  return adjusted;
}

const VIBE_SET = new Set<string>(ALL_VIBES);

async function analyze(
  client: OpenAI,
  input: string,
  answers: ClassifyAnswer[],
  context: ClassifyContext,
): Promise<AnalyzeResult> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.2, // low — scoring should be stable, not creative
    messages: [
      { role: "system", content: buildAnalyzeSystemPrompt() },
      { role: "user", content: buildAnalyzeUserMessage(input, answers, context) },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("classify_unparseable");
  }

  const language = typeof parsed.language === "string"
    ? parsed.language.trim().slice(0, 8).toLowerCase()
    : "en";
  const title = typeof parsed.title === "string"
    ? parsed.title.replace(/\s+/g, " ").trim().slice(0, 120)
    : "";
  const vibeRaw = typeof parsed.vibe === "string" ? parsed.vibe.trim().toLowerCase() : "minimal";
  const vibe: Vibe = VIBE_SET.has(vibeRaw) ? (vibeRaw as Vibe) : "minimal";

  const scores: Record<string, number> = {};
  const rawScores = parsed.scores && typeof parsed.scores === "object"
    ? (parsed.scores as Record<string, unknown>)
    : {};
  for (const t of AI_SCORABLE_TYPES) {
    const v = rawScores[t];
    const n = typeof v === "number" ? v : Number(v);
    scores[t] = Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : 0;
  }

  return { language, title, vibe, scores: applyProjectModeScoreBias(scores, context) };
}

// ── Server-side selection (the anti-bias core) ────────────────────────

export function selectModuleTypes(scores: Record<string, number>): ModuleType[] {
  const ranked = AI_SCORABLE_TYPES
    .map((type) => ({ type, score: scores[type] ?? 0 }))
    // Sort by score desc; stable tie-break by registry order keeps it
    // deterministic without privileging any single module.
    .sort((a, b) => b.score - a.score);

  const chosen: ModuleType[] = [];
  let dateUsed = false;
  let placeUsed = false;

  for (const { type, score } of ranked) {
    if (chosen.length >= MAX_BODY) break;
    if (score < MIN_SCORE) break; // ranked desc — nothing below passes
    if (DATE_GROUP.has(type)) {
      if (dateUsed) continue; // keep only the highest-scoring date widget
      dateUsed = true;
    }
    if (PLACE_GROUP.has(type)) {
      if (placeUsed) continue; // keep only the highest-scoring place widget
      placeUsed = true;
    }
    chosen.push(type);
  }

  // Fallback: if too few cleared the threshold, take the next-best
  // candidates (even below threshold) so the page isn't bare — but
  // never anything that scored a flat 0.
  if (chosen.length < MIN_BODY) {
    for (const { type, score } of ranked) {
      if (chosen.length >= MIN_BODY) break;
      if (chosen.includes(type)) continue;
      if (score <= 0) continue;
      if (DATE_GROUP.has(type) && dateUsed) continue;
      if (PLACE_GROUP.has(type) && placeUsed) continue;
      if (DATE_GROUP.has(type)) dateUsed = true;
      if (PLACE_GROUP.has(type)) placeUsed = true;
      chosen.push(type);
    }
  }

  return chosen;
}

// ── Stage B: author the selected widgets ──────────────────────────────

/** Compact JSON shape hint per authorable widget type. */
const SHAPE: Partial<Record<ModuleType, string>> = {
  ai_summary: `{"type":"ai_summary","microTitle":"<short label>","text":"<2-4 sentence abstract take>"}`,
  wikipedia: `{"type":"wikipedia","microTitle":"<short label>","topic":"<EXACT real Wikipedia article title — must be a genuinely existing article>"}`,
  location_single: `{"type":"location_single","microTitle":"<short label>","query":"<a REAL, specific, geocodable place — full name incl. city/country, e.g. 'Parc des Buttes-Chaumont, Paris'>","label":"<short display name>"}`,
  locations_multi: `{"type":"locations_multi","microTitle":"<short label>","queries":[{"query":"<real geocodable place incl. city>","label":"<short>"}]}`,
  route: `{"type":"route","microTitle":"<short label>","stops":[{"query":"<real geocodable place incl. city>","label":"<short>"}]}`,
  location_suggestions: `{"type":"location_suggestions","microTitle":"<short label>","suggestions":[{"label":"<real place name or place type>","address":"<optional>"}]}`,
  date: `{"type":"date","microTitle":"<short label>","date":"YYYY-MM-DD"}`,
  appointment: `{"type":"appointment","microTitle":"<short label>","datetime":"<ISO 8601>"}`,
  appointments: `{"type":"appointments","microTitle":"<short label>","entries":[{"datetime":"<ISO 8601>","label":"<short>"}]}`,
  range: `{"type":"range","microTitle":"<short label>","unit":"time|weekday|month|year|date|place|amount|generic","from":"<value>","to":"<value>"}`,
  phases: `{"type":"phases","microTitle":"<short label>","phases":[{"label":"<short>","description":"<optional>"}],"currentPhase":0}`,
  crew: `{"type":"crew","microTitle":"<short label>","description":"<optional 1-line context>","roles":[{"name":"<role>"}]}`,
  work_packages: `{"type":"work_packages","microTitle":"<short label>","packages":[{"label":"<package>","description":"<optional>"}]}`,
  checklist: `{"type":"checklist","microTitle":"<short label>","description":"<optional 1-line context>","items":[{"text":"<concrete item>"}]}`,
  notes: `{"type":"notes","microTitle":"<short label>","description":"<optional 1-line context>","placeholder":"<optional short invite>"}`,
  qa: `{"type":"qa","microTitle":"<short label>","description":"<optional 1-line context>","placeholder":"<optional short invite>"}`,
  poll: `{"type":"poll","microTitle":"<short label>","question":"<question>","options":["<opt>","<opt>"]}`,
  discussion: `{"type":"discussion","microTitle":"<short label>","description":"<optional 1-line context>","placeholder":"<optional short invite>"}`,
  table: `{"type":"table","microTitle":"<short label>","description":"<optional 1-line context>","columns":["<col>","<col>"],"rows":[["<cell>","<cell>"]]}`,
  parts_list: `{"type":"parts_list","microTitle":"<short label>","description":"<optional 1-line context>","items":[{"name":"<item>","quantity":"<optional>"}]}`,
  attachments: `{"type":"attachments","microTitle":"<short label>","description":"<optional 1-line context>","placeholder":"<optional short invite>"}`,
  images: `{"type":"images","microTitle":"<short label>","description":"<optional 1-line context>","placeholder":"<optional short invite>"}`,
  audio: `{"type":"audio","microTitle":"<short label>","description":"<optional 1-line context>","placeholder":"<optional short invite>"}`,
  sketch: `{"type":"sketch","microTitle":"<short label>","description":"<optional 1-line context>","placeholder":"<optional short invite>"}`,
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", de: "German", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ru: "Russian", ja: "Japanese",
  zh: "Chinese", ar: "Arabic", tr: "Turkish", ko: "Korean", sv: "Swedish",
};

function languageName(code: string): string {
  return LANGUAGE_NAMES[code.split("-")[0]] || code;
}

interface AuthorResult {
  richText: Module | null;
  tags: Module | null;
  body: Module[];
  labels: SpaceLabels;
  style: SpaceStyle | null;
}

function shapeFor(type: ModuleType, context: ClassifyContext): string {
  const hinted = projectModeShapeHints(context.projectMode)[type];
  return hinted ?? SHAPE[type] ?? `{"type":"${type}","microTitle":"<short label>"}`;
}

function buildAuthorSystemPrompt(language: string, chosen: ModuleType[], context: ClassifyContext): string {
  const langName = languageName(language);
  const shapes = chosen
    .map((t) => `  - ${t}:\n      ${shapeFor(t, context)}`)
    .join("\n");
  const guide = projectModeAuthoringGuide(context.projectMode);

  const fontList = FONT_NAMES.join(", ");

  return `You are the authoring stage of a workspace composer. The widgets to
build have ALREADY been chosen. Your job is to fill them with content
that serves the user's input, and to assign a fitting visual style.

OUTPUT LANGUAGE: ${langName} (code: ${language}).
EVERY visible string you write — titles, microTitles, prose, tags,
options, item text, labels — MUST be in ${langName}. This is absolute.
The only thing that stays in English is the internal "type" field.

Return STRICT JSON, no preamble:

{
  "richText": { "type":"rich_text", "microTitle":"<small framing word in ${langName}>", "text":"<2-4 reflective sentences in ${langName}>" },
  "tags":     { "type":"tags", "tags":["<3-6 short tags in ${langName}>"] },
  "body":     [ <one object per chosen widget, in the order listed> ],
  "labels":   { ...UI strings in ${langName}... },
  "style":    { "font":"<one family from the list>", "color1":"#rrggbb", "color2":"#rrggbb", "background":"#rrggbb" }
}

THE CHOSEN BODY WIDGETS — author exactly these, in this order:
${shapes}

${guide ? `PROJECT-TYPE AUTHORING GUIDE:\n- ${guide}\n` : ""}

STYLE — assign a palette + font that matches the input's MOOD:
- font: choose exactly one family name from this list:
  ${fontList}
  Match register — serif/Fraunces/Lora for warm or editorial; a clean
  sans (Inter/DM Sans/Work Sans) for practical/organisational; mono
  (JetBrains Mono/Space Mono) for technical; display (Unbounded/Syne/
  Bricolage Grotesque) for bold/creative; hand (Caveat/Shantell Sans)
  for playful.
  Pick the COLOUR HUES from the SUBJECT itself — what the matter is
  actually about, not a generic palette. Examples: a repair café →
  warm craft tones (amber, terracotta, moss); a sea-swim group → cool
  blue-greens; a jazz night → deep wine/indigo; a garden project →
  leaf greens. Avoid hot neon / candy colours unless the subject is
  explicitly loud or playful. Tasteful and on-topic beats vivid.
  (The system automatically re-lightens your choices into a readable
  band — a light canvas, dark ink, mid accent — so you only need to
  get the HUE and mood right, not the exact lightness.)
- color1: the primary ink hue (text, borders).
- color2: the accent hue (widget tint + map pins/routes) — clearly
  distinct from color1, drawn from the same subject palette.
- background: the page-canvas hue (a faint tint of the subject's mood).

CONTENT RULES:
- Never invent specifics: no fake place names, no fake Wikipedia
  titles that don't exist, no fake dates, no fake numbers. If you lack
  a real value for a date/appointment, omit that widget from "body".
- Use UI CONTEXT as a planning lens. For example, a selected photo shoot
  project type should make tables useful as shot lists/deliverables,
  images useful as reference/moodboard slots, checklist useful as prep,
  crew useful as roles, and appointments/ranges useful only when the
  input or clarifications provide real timing. Keep unconfirmed details
  phrased as questions, suggestions, or assumptions rather than facts.
- For map widgets (location_single, locations_multi, route), the
  "query" must be a SPECIFIC, named, geocodable VENUE or address —
  a hall, park, café, landmark, street address — with its city and
  country (e.g. "Parc des Buttes-Chaumont, Paris, France"). A bare
  city or district name ("Paris", "11e arrondissement") is NOT
  acceptable — it pins the map to a meaningless centroid. If the input
  names only a city/area and no specific venue, emit
  location_suggestions (a text list of candidate venues) instead of a
  coordinate map.
- Seed-content widgets (poll, checklist, crew, work_packages, phases,
  table, parts_list, location_suggestions) must contain real, concrete
  starter content drawn from the input — never empty arrays, never
  placeholder text like "Option 1".
- Collaboration / upload widgets (notes, qa, discussion, attachments,
  images, audio, sketch) may use microTitle plus optional description
  and placeholder guidance, but they must NOT invent conversation
  entries, uploaded files, or finished approvals.
- microTitles are short (1-3 words) and in ${langName}.

LABELS — the UI chrome strings, all in ${langName}, each under 60 chars:
{
  "publishCta": "<verb for publish, e.g. publish ↗>",
  "publishTitle": "<5-8 word publish modal heading>",
  "publishExplanation": "<1-2 sentences explaining publishing>",
  "cancel": "<cancel>",
  "publishConfirm": "<confirm publishing>",
  "signInPrompt": "<short reason sign-in is needed>",
  "signInCta": "<sign in>",
  "signedInAs": "<'logged in as' phrase>",
  "visibilityPublic": "<public>",
  "visibilityPrivate": "<private>",
  "copy": "<copy>",
  "copied": "<copied>",
  "backToCurrent": "<back to current>",
  "viewingVersionPrefix": "<'viewing version' phrase>",
  "emptyGrid": "<empty-grid headline>",
  "emptyGridHint": "<short hint that widgets go here>",
  "participants": "<1 word for the people involved, e.g. 'people'>"
}

Output ONLY the JSON object.`;
}

function sanitizeLabels(raw: unknown): SpaceLabels {
  const out: SpaceLabels = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  const strOut = out as Record<string, string>;
  for (const k of AI_LABEL_KEYS) {
    const v = r[k];
    if (typeof v === "string") {
      const cleaned = v.trim().slice(0, 200);
      if (cleaned) strOut[k] = cleaned;
    }
  }
  return out;
}

async function author(
  client: OpenAI,
  input: string,
  answers: ClassifyAnswer[],
  language: string,
  chosen: ModuleType[],
  context: ClassifyContext,
): Promise<AuthorResult> {
  if (chosen.length === 0) {
    // No body widgets — still author header + labels.
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.6, // higher — authoring benefits from some variety
    messages: [
      { role: "system", content: buildAuthorSystemPrompt(language, chosen, context) },
      { role: "user", content: buildAnalyzeUserMessage(input, answers, context) },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("classify_unparseable");
  }

  const richText = parsed.richText ? sanitizeModules([parsed.richText])[0] ?? null : null;
  const tags = parsed.tags ? sanitizeModules([parsed.tags])[0] ?? null : null;
  const rawBody = Array.isArray(parsed.body) ? parsed.body : [];
  // Resolve map widgets' place names into real coordinates BEFORE
  // sanitisation (the sanitizer requires coords; the AI emits names).
  // Unresolvable maps are dropped here rather than pinned to a guess.
  const geocodedBody = await resolveGeocoding(rawBody);
  const body = sanitizeModules(geocodedBody).filter(
    (m) => m.type !== "heading" && m.type !== "rich_text" && m.type !== "tags",
  );
  const labels = sanitizeLabels(parsed.labels);
  const style = sanitizeStyle(parsed.style);

  return { richText, tags, body, labels, style };
}

// ── Public API ────────────────────────────────────────────────────────

export interface ClassifyAnswer {
  questionId: string;
  questionText: string;
  choice: string;
}

export interface ClassifyResult {
  title: string;
  language: string;
  vibe: Vibe;
  modules: Module[];
  labels: SpaceLabels;
  style: SpaceStyle | null;
}

function prep(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 1200);
}

export async function classifyInput(
  text: string,
  answers: ClassifyAnswer[] = [],
  /** Modules the user already configured in the clarify step (location
   *  pin, phases, …). These are kept verbatim — not re-authored, not
   *  re-geocoded — and the author stage skips their type (and its
   *  redundancy group, e.g. another place widget). */
  configuredModules: Module[] = [],
  context: ClassifyContext = {},
): Promise<ClassifyResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");
  const input = prep(text);
  if (input.length < 3) throw new Error("input_too_short");

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 20_000,
  });

  // Stage A — analyze + score.
  const a = await analyze(client, input, answers, context);

  // Server-side deterministic selection.
  let chosen = selectModuleTypes(a.scores);

  // One observability line per request (Vercel function logs) — the
  // basis for tuning MIN_SCORE/MIN_BODY against real inputs.
  console.log(
    `[classify] mode=${String(context.projectMode || "-")} lang=${a.language} chosen=[${chosen.join(",")}] scores=` +
    Object.entries(a.scores)
      .filter(([, v]) => v > 0)
      .sort(([, x], [, y]) => y - x)
      .map(([k, v]) => `${k}:${v}`)
      .join(" "),
  );

  // Honour pre-configured modules: drop their type AND any type in the
  // same redundancy group from what the author will produce, so we never
  // get a second place/date widget competing with the user's choice.
  const preTypes = new Set(configuredModules.map((m) => m.type));
  const suppress = new Set<ModuleType>(preTypes);
  for (const t of preTypes) {
    if (PLACE_GROUP.has(t)) PLACE_GROUP.forEach((x) => suppress.add(x));
    if (DATE_GROUP.has(t)) DATE_GROUP.forEach((x) => suppress.add(x));
  }
  chosen = chosen.filter((t) => !suppress.has(t));

  // Stage B — author the chosen widgets in the detected language.
  const authored = await author(client, input, answers, a.language, chosen, context);

  // Assemble in header-zone order: heading → rich_text → tags →
  // (user-configured body first) → authored body.
  const configuredBody = configuredModules.filter(
    (m) => m.type !== "heading" && m.type !== "rich_text" && m.type !== "tags",
  );
  // De-dupe: the author occasionally emits a type twice, or re-emits a
  // type the user already configured. One widget per type per space.
  const usedTypes = new Set<string>(configuredBody.map((m) => m.type));
  const authoredBody = authored.body.filter((m) => {
    if (usedTypes.has(m.type)) return false;
    usedTypes.add(m.type);
    return true;
  });
  const ordered: Module[] = [];
  ordered.push({ type: "heading", text: a.title || input.slice(0, 60), level: 1 });
  if (authored.richText) ordered.push(authored.richText);
  if (authored.tags) ordered.push(authored.tags);
  ordered.push(...configuredBody);
  ordered.push(...authoredBody);

  return {
    title: a.title,
    language: a.language,
    vibe: a.vibe,
    modules: ordered,
    labels: authored.labels,
    style: authored.style,
  };
}
