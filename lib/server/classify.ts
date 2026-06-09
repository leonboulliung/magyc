import OpenAI from "openai";
import {
  MODULE_META,
  alwaysInsertedTypes,
  bodyTypes,
  mandatoryConfigTypes,
  sanitizeModules,
} from "@/lib/modules";
import { ALL_VIBES, type Module, type SpaceLabels, type Vibe } from "@/lib/types";

/**
 * Classifier v4 — the dossier author for the 29-widget catalog.
 *
 * Builds the system prompt dynamically from MODULE_META so adding a
 * widget type means one place (lib/modules.ts) and the prompt picks
 * it up automatically.
 *
 * The classifier produces, in a single call:
 *   - title + language + vibe
 *   - 3 always-present header widgets (heading, rich_text, tags)
 *   - 2-7 body widgets picked from the catalog according to the
 *     relevantWhen rule per type
 *   - a `labels` object with every UI string the surface needs, in
 *     the input's language (the application itself has no own
 *     visible language)
 */

interface CatalogEntry {
  type: string;
  rule: string;
  mandatory: boolean;
  source: string;
}

function buildCatalog(): { header: CatalogEntry[]; body: CatalogEntry[] } {
  const toEntry = (type: string): CatalogEntry => {
    const meta = MODULE_META[type as keyof typeof MODULE_META];
    return {
      type,
      rule: meta.relevantWhen,
      mandatory: meta.requiresMandatoryConfig,
      source: meta.externalSource ?? "none",
    };
  };
  return {
    header: alwaysInsertedTypes().map(toEntry),
    body: bodyTypes().map(toEntry),
  };
}

function buildSystemPrompt(): string {
  const { header, body } = buildCatalog();

  const headerLines = header
    .map((e) => `  - ${e.type} — ${e.rule}`)
    .join("\n");

  const bodyLines = body
    .map((e) => {
      const tags: string[] = [];
      if (e.mandatory) tags.push("MANDATORY-CONFIG");
      if (e.source !== "none") tags.push(`source:${e.source}`);
      const tagStr = tags.length ? `  [${tags.join(", ")}]` : "";
      return `  - ${e.type}${tagStr}\n      ${e.rule}`;
    })
    .join("\n");

  const mandatoryList = mandatoryConfigTypes().join(", ");

  return `You compose a small "magyc.site" workspace from a single short input
the user wrote — a thought, an idea, a wish, a concern, a plan.

Return STRICT JSON, no preamble. Schema:

  {
    "title":    "<3-8 word headline in user's language>",
    "language": "<ISO 639-1 code matching input>",
    "vibe":     "<one of: editorial | document | dashboard | terminal | soft | minimal>",
    "modules":  [ ... 5-10 widgets ... ],
    "labels":   { ... UI strings in user's language ... }
  }

HARD RULES
----------
- MATCH THE INPUT'S LANGUAGE for every visible string (titles,
  microTitles, labels, options, descriptions). The application has
  NO own language — every word the user sees on the page must come
  from this response in their language.
- Never invent specifics: no fake place names, no fake Wikipedia
  titles, no fake coordinates, no fake numbers, no fake dates.
- Module \`type\` discriminators stay in English — they are internal
  identifiers, NEVER shown to the user.

THE THREE ALWAYS-PRESENT HEADER WIDGETS
---------------------------------------
These three MUST appear, in this order, at the start of the modules
array. They live in the page's header zone, not in the grid.

${headerLines}

  Heading shape:
    { "type": "heading", "text": "<title>", "level": 1, "microTitle"?: null }

  Rich Text shape:
    { "type": "rich_text",
      "microTitle": "<small label in user's language, e.g. \"Kontext\", \"Background\", \"Idea\">",
      "text": "<2-4 sentences of reflective prose>" }

  Tags shape:
    { "type": "tags",
      "tags": ["3-6 short tags in user's language"] }

THE 26 BODY WIDGETS — pick 2-7 based on which RULES match the input
-----------------------------------------------------------------
Each entry below lists the widget type, optional tags (MANDATORY-CONFIG
means the widget needs explicit data the user has confirmed, source
indicates external data dependency), and the rule for inclusion.

${bodyLines}

PICKING RULES
-------------
- Read the input carefully. For each body widget, ask: does the rule
  apply CONCRETELY to this input? If yes, include. If no, skip.
- Be sparse. 2-7 body widgets total. A space crowded with widgets
  is worse than one with the right 3.
- Every body widget you include should serve THIS input — not a
  generic shape it could fit into.
- For MANDATORY-CONFIG widgets (${mandatoryList}): only include if
  the input clearly tells you the data. If the input mentions a
  location need but no actual place, prefer location_suggestions
  over location_single. If chronology is unclear, prefer not to
  include phases at all.

WIDGET-SPECIFIC GUIDANCE
------------------------
For widgets that take seed content, the AI fills the seed; visitors
react. Don't ship empty arrays. Examples:
  - poll: question + 2-4 real options
  - checklist: 3-6 concrete items
  - work_packages: 2-5 concrete package labels
  - crew: 2-5 role names
  - phases: 3-6 phase labels in chronological order
  - table: meaningful columns + at least 2 seed rows
  - parts_list: 3-6 named items

For widgets that mostly fill via collaboration (notes, qa, discussion,
attachments, images, audio, sketch), provide an empty config plus a
microTitle reflecting the input.

LABELS — every UI string the surface needs
------------------------------------------
The labels object carries the words the published space displays.
Every entry is in the user's language. Keep each under 60 characters.

  {
    "publishCta":          "<short verb for publishing, e.g. 'publish ↗'>",
    "publishTitle":        "<5-8 words for publish modal heading>",
    "publishExplanation":  "<1-2 sentences explaining publish in user's language>",
    "cancel":              "<cancel>",
    "publishConfirm":      "<confirm publishing>",
    "signInPrompt":        "<short reason sign-in is required>",
    "signInCta":           "<sign in label>",
    "signedInAs":          "<'logged in as' phrase>",

    "visibilityPublic":    "<public>",
    "visibilityPrivate":   "<private>",
    "copy":                "<copy>",
    "copied":              "<copied>",

    "backToCurrent":       "<back to current>",
    "viewingVersionPrefix":"<'viewing version' phrase>",

    "emptyGrid":           "<empty grid headline, e.g. 'empty grid'>",
    "emptyGridHint":       "<short hint, e.g. 'widgets land here'>"
  }

If the input is in German: every label string in German.
If French: French. Same for any other language. NEVER mix.

Output ONLY the JSON object.`;
}

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
}

const VIBE_SET = new Set<string>(ALL_VIBES);

const LABEL_KEYS: readonly (keyof SpaceLabels)[] = [
  "publishCta", "publishTitle", "publishExplanation", "cancel",
  "publishConfirm", "signInPrompt", "signInCta", "signedInAs",
  "visibilityPublic", "visibilityPrivate", "copy", "copied",
  "backToCurrent", "viewingVersionPrefix",
  "emptyGrid", "emptyGridHint",
];

function sanitizeLabels(raw: unknown): SpaceLabels {
  const out: SpaceLabels = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const k of LABEL_KEYS) {
    const v = r[k];
    if (typeof v === "string") {
      const cleaned = v.trim().slice(0, 200);
      if (cleaned) out[k] = cleaned;
    }
  }
  return out;
}

function prep(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 1200);
}

function buildUserMessage(input: string, answers: ClassifyAnswer[]): string {
  const lines: string[] = [`INPUT:`, input.trim()];
  if (answers.length > 0) {
    lines.push("", "ANSWERS:");
    for (const a of answers) {
      lines.push(`- ${a.questionText.trim()} → ${a.choice.trim()}`);
    }
  }
  return lines.join("\n");
}

export async function classifyInput(
  text: string,
  answers: ClassifyAnswer[] = [],
): Promise<ClassifyResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");
  const input = prep(text);
  if (input.length < 3) throw new Error("input_too_short");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.3,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserMessage(input, answers) },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("classify_unparseable");
  }

  const title = typeof parsed.title === "string"
    ? parsed.title.replace(/\s+/g, " ").trim().slice(0, 120)
    : "";
  const language = typeof parsed.language === "string"
    ? parsed.language.trim().slice(0, 8).toLowerCase()
    : "en";
  const vibeRaw = typeof parsed.vibe === "string" ? parsed.vibe.trim().toLowerCase() : "minimal";
  const vibe: Vibe = VIBE_SET.has(vibeRaw) ? (vibeRaw as Vibe) : "minimal";
  const modules = sanitizeModules(parsed.modules);
  const labels = sanitizeLabels(parsed.labels);

  // Enforce header-zone ordering: heading → rich_text → tags → body.
  // Inject a default heading from the title if the AI omitted one.
  const heading = modules.find((m) => m.type === "heading");
  const richText = modules.find((m) => m.type === "rich_text");
  const tags = modules.find((m) => m.type === "tags");
  const body = modules.filter((m) =>
    m.type !== "heading" && m.type !== "rich_text" && m.type !== "tags",
  );
  const ordered: Module[] = [];
  if (heading) ordered.push(heading);
  else if (title) ordered.push({ type: "heading", text: title, level: 1 });
  if (richText) ordered.push(richText);
  if (tags) ordered.push(tags);
  ordered.push(...body);

  return { title, language, vibe, modules: ordered, labels };
}
