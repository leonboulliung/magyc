import OpenAI from "openai";
import { sanitizeModule } from "@/lib/modules";
import type { Module, ModuleType, SpaceLabels, Vibe } from "@/lib/types";

/**
 * Regenerate — given a single widget on a space, return N alternative
 * configurations of the same widget type.
 *
 * Powers the "Wechsel"-button UX described in the CSV:
 *   - Wikipedia: 2 alternative articles (the edit cycle)
 *   - AI Summary: 4 alternative paragraphs
 *   - Icon: 6 alternative icons, with a "5 more" refresh
 *
 * Per-widget logic lives in REGEN_HANDLERS below — each handler
 * knows how to build a focused prompt for its type and how many
 * alternatives are the default. Widget types that should NOT be
 * regenerated (user-content slots like notes, qa, discussion,
 * sketch, attachments, images, audio, dates, exact map locations)
 * return null; the API surface refuses the request.
 */

/** Inputs that travel into every regenerator. */
export interface RegenContext {
  /** The original input text the user wrote. */
  spaceInput: string;
  /** The language code (ISO 639-1) the space was generated in. */
  language: string;
  /** Vibe for stylistic hints. */
  vibe: Vibe;
  /** Existing labels carried for context only — not regenerated here. */
  labels: SpaceLabels;
  /** Current widget config (so suggestions can diverge from it). */
  current: Module;
  /** Optional user-supplied guidance ("more energetic", "in cyan", a
   *  pasted URL, …). Free text. */
  basePrompt?: string;
  /** How many alternatives to return. Capped per widget type. */
  count?: number;
}

export interface RegenResult {
  suggestions: Module[];
}

/** Per-widget defaults + caps. */
const REGEN_LIMITS: Partial<Record<ModuleType, { defaultCount: number; max: number }>> = {
  heading:      { defaultCount: 3, max: 6 },
  rich_text:    { defaultCount: 3, max: 6 },
  tags:         { defaultCount: 3, max: 6 },
  wikipedia:    { defaultCount: 2, max: 4 },
  ai_summary:   { defaultCount: 4, max: 6 },
  icon:         { defaultCount: 6, max: 12 },
  poll:         { defaultCount: 3, max: 6 },
  phases:       { defaultCount: 3, max: 5 },
  checklist:    { defaultCount: 3, max: 5 },
  crew:         { defaultCount: 3, max: 5 },
  work_packages:{ defaultCount: 3, max: 5 },
  deliverables: { defaultCount: 3, max: 5 },
  approvals:    { defaultCount: 3, max: 5 },
  table:        { defaultCount: 3, max: 5 },
  parts_list:   { defaultCount: 3, max: 5 },
  range:        { defaultCount: 3, max: 5 },
  gif:          { defaultCount: 6, max: 12 },
};

/** Widget types we explicitly refuse to regenerate. They're either
 *  user-content slots or user-confirmed data points. */
const REGEN_BLOCKED: ReadonlySet<ModuleType> = new Set<ModuleType>([
  "notes",
  "qa",
  "discussion",
  "sketch",
  "attachments",
  "images",
  "audio",
  "date",
  "appointment",
  "appointments",
  "location_single",
  "locations_multi",
  "location_suggestions",
  "route",
  "ai_summary", // see special handler below — kept separate from generic
]);

/**
 * Per-widget prompts. Each returns a system+user pair tuned for that
 * widget type. Falls through to the generic prompt when no specific
 * handler exists — useful for newly-added widget types that don't
 * have bespoke prompting yet.
 */
type Handler = (ctx: RegenContext, count: number) => { system: string; user: string };

const baseContext = (ctx: RegenContext) => `INPUT TEXT (user's own):
${ctx.spaceInput}

LANGUAGE: ${ctx.language}
VIBE: ${ctx.vibe}
CURRENT WIDGET (JSON):
${JSON.stringify(ctx.current, null, 2)}${ctx.basePrompt ? `\n\nUSER GUIDANCE: ${ctx.basePrompt}` : ""}`;

const HANDLERS: Partial<Record<ModuleType, Handler>> = {
  heading: (ctx, n) => ({
    system: `Generate ${n} alternative HEADINGS for a workspace.
Each alternative must be in the user's language (${ctx.language}) and
3-8 words long. None may duplicate the current heading. Return
STRICT JSON: { "suggestions": [ { "type": "heading", "text": "...", "level": 1 }, ... ] }`,
    user: baseContext(ctx),
  }),

  rich_text: (ctx, n) => ({
    system: `Generate ${n} alternative reflective paragraphs for a
workspace's rich_text widget. Each must be in ${ctx.language},
2-4 sentences, second person, mirror the user's input. Set the
microTitle to a small word like "context", "background", "idea",
"intent" — in ${ctx.language}. Return STRICT JSON:
{ "suggestions": [ { "type": "rich_text", "microTitle": "...", "text": "..." }, ... ] }`,
    user: baseContext(ctx),
  }),

  tags: (ctx, n) => ({
    system: `Generate ${n} alternative TAG SETS for the space. Each
set has 3-6 short tags in ${ctx.language}, no duplicates with the
current set. Return STRICT JSON:
{ "suggestions": [ { "type": "tags", "tags": ["...", ...] }, ... ] }`,
    user: baseContext(ctx),
  }),

  wikipedia: (ctx, n) => ({
    system: `Suggest ${n} alternative Wikipedia article titles for
this workspace's reference widget. Each must be a REAL article title
on en.wikipedia.org (the backend will resolve via OpenSearch and
reject anything that doesn't exist). Pick titles that genuinely
match the input's named concepts. Skip generic / overly broad
articles. Set microTitle to a tiny label in ${ctx.language}.
Return STRICT JSON:
{ "suggestions": [ { "type": "wikipedia", "topic": "<exact title>",
  "microTitle": "...", "attribution": { "name": "Wikipedia",
  "url": "https://en.wikipedia.org", "license": "CC-BY-SA 4.0" } }, ... ] }`,
    user: baseContext(ctx),
  }),

  icon: (ctx, n) => ({
    system: `Suggest ${n} alternative Iconify identifiers for this
workspace's icon widget. Use the "set:name" format — prefer "lucide:",
"phosphor:", "tabler:". Each must be a real icon name that exists in
the set. Pick icons that match the SEMANTIC anchor of the input, not
generic placeholders. None may duplicate the current icon. Set
microTitle to null or undefined. Return STRICT JSON:
{ "suggestions": [ { "type": "icon", "iconify": "lucide:..." }, ... ] }`,
    user: baseContext(ctx),
  }),

  poll: (ctx, n) => ({
    system: `Generate ${n} alternative POLL configurations. Each has
a question + 2-4 SHORT real options, all in ${ctx.language}. The
question must be one the input actually raises; options should be
plausible answers. Return STRICT JSON:
{ "suggestions": [ { "type": "poll", "microTitle": "...",
  "question": "...", "options": ["...", "..."] }, ... ] }`,
    user: baseContext(ctx),
  }),

  phases: (ctx, n) => ({
    system: `Generate ${n} alternative PHASE SEQUENCES. Each is
3-6 short chronological labels in ${ctx.language}. currentPhase
should be 0 (the start). Return STRICT JSON:
{ "suggestions": [ { "type": "phases", "microTitle": "...",
  "phases": [{"label":"..."}], "currentPhase": 0 }, ... ] }`,
    user: baseContext(ctx),
  }),

  checklist: (ctx, n) => ({
    system: `Generate ${n} alternative CHECKLIST configurations.
Each has 3-6 concrete action items in ${ctx.language}. Return
STRICT JSON:
{ "suggestions": [ { "type": "checklist", "microTitle": "...",
  "items": [{"text":"..."}] }, ... ] }`,
    user: baseContext(ctx),
  }),

  crew: (ctx, n) => ({
    system: `Generate ${n} alternative CREW configurations. Each
has 2-5 short role names in ${ctx.language}. Return STRICT JSON:
{ "suggestions": [ { "type": "crew", "microTitle": "...",
  "roles": [{"name":"..."}] }, ... ] }`,
    user: baseContext(ctx),
  }),

  work_packages: (ctx, n) => ({
    system: `Generate ${n} alternative WORK PACKAGE sets. Each has
2-5 short package labels + optional descriptions in ${ctx.language}.
Return STRICT JSON:
{ "suggestions": [ { "type": "work_packages", "microTitle": "...",
  "packages": [{"label":"...","description":"..."}] }, ... ] }`,
    user: baseContext(ctx),
  }),

  deliverables: (ctx, n) => ({
    system: `Generate ${n} alternative DELIVERABLE sets. Each has
2-5 concrete outputs in ${ctx.language}. Every item needs a short
label and may include details, quantity, format, due, or a workflow
status. Keep them
practical and outcome-focused. Return STRICT JSON:
{ "suggestions": [ { "type": "deliverables", "microTitle": "...",
  "items": [{"label":"...","details":"...","quantity":"...","format":"...","due":"...","status":"planned|in_progress|ready|delivered"}] }, ... ] }`,
    user: baseContext(ctx),
  }),

  approvals: (ctx, n) => ({
    system: `Generate ${n} alternative APPROVAL widget configurations.
Each has 2-5 explicit sign-off checkpoints in ${ctx.language}; each
item may also include a short description, due cue, audience, or
workflow status. Return STRICT JSON:
{ "suggestions": [ { "type": "approvals", "microTitle": "...",
  "items": [{"text":"...","description":"...","due":"...","audience":"client|internal","status":"pending|requested|approved"}] }, ... ] }`,
    user: baseContext(ctx),
  }),

  table: (ctx, n) => ({
    system: `Generate ${n} alternative TABLE configurations. Each
has 2-5 column headers + 2-5 seed rows in ${ctx.language}. Return
STRICT JSON:
{ "suggestions": [ { "type": "table", "microTitle": "...",
  "columns": ["..."], "rows": [["..."]] }, ... ] }`,
    user: baseContext(ctx),
  }),

  parts_list: (ctx, n) => ({
    system: `Generate ${n} alternative PARTS LISTS. Each has 3-8
named items + optional quantities in ${ctx.language}. Do NOT invent
imageUrl values. Return STRICT JSON:
{ "suggestions": [ { "type": "parts_list", "microTitle": "...",
  "items": [{"name":"...","quantity":"..."}] }, ... ] }`,
    user: baseContext(ctx),
  }),

  range: (ctx, n) => ({
    system: `Generate ${n} alternative RANGE configurations (from/to).
Each in ${ctx.language}. Pick a sensible unit (time | weekday |
month | year | date | place | amount | generic). Return STRICT JSON:
{ "suggestions": [ { "type": "range", "unit": "...",
  "from": "...", "to": "..." }, ... ] }`,
    user: baseContext(ctx),
  }),
};

/** Special handler for ai_summary — fully generative and gets its
 *  own prompt rather than the blocked path. */
const AI_SUMMARY_HANDLER: Handler = (ctx, n) => ({
  system: `Generate ${n} alternative AI-summary paragraphs for the
"ai_summary" widget. Each is a generalised, slightly abstract take
on the input that helps the reader see it from a useful angle.
2-4 sentences each, in ${ctx.language}. None may duplicate the
current text. Return STRICT JSON:
{ "suggestions": [ { "type": "ai_summary",
  "microTitle": "<small label in ${ctx.language}>",
  "text": "..." }, ... ] }`,
  user: baseContext(ctx),
});

export async function regenerateWidget(ctx: RegenContext): Promise<RegenResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");
  const type = ctx.current.type;

  // ai_summary is the only exception that's both blocked and supported
  // by a special handler — the blocked-set check skips it explicitly
  // below.
  if (REGEN_BLOCKED.has(type) && type !== "ai_summary") {
    throw new Error("regen_not_supported");
  }

  const handler =
    type === "ai_summary" ? AI_SUMMARY_HANDLER : HANDLERS[type];
  if (!handler) {
    throw new Error("regen_not_supported");
  }

  const limits = REGEN_LIMITS[type];
  const defaultCount = limits?.defaultCount ?? 3;
  const max = limits?.max ?? 6;
  const count = Math.max(1, Math.min(max, ctx.count ?? defaultCount));

  const { system, user } = handler(ctx, count);

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 15_000,
  });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.5,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("regen_unparseable");
  }

  const rawSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const suggestions: Module[] = [];
  for (const candidate of rawSuggestions) {
    const m = sanitizeModule(candidate);
    if (!m) continue;
    if (m.type !== type) continue; // safety — must match the asked-for type
    suggestions.push(m);
    if (suggestions.length >= count) break;
  }

  if (suggestions.length === 0) throw new Error("regen_empty");
  return { suggestions };
}
