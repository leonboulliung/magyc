import OpenAI from "openai";
import { MODULE_META, mandatoryConfigTypes } from "@/lib/modules";
import type { ModuleType } from "@/lib/types";

/**
 * Clarify v2 — single-step (B1), but aware of mandatory-config widgets.
 *
 * The classifier is the one that DECIDES which widgets to use, but
 * mandatory-config widgets (location_single, route, phases, …) need
 * specific data from the user before the page can be assembled. Rather
 * than ask in a separate second pass, we let this clarify call decide
 * which data questions are worth asking up front.
 *
 * The result is one mixed list of 2–5 questions: some "general"
 * (intent / scope / commitment), some "data" (a specific place, a
 * chronology, …). The frontend renders both kinds identically but
 * marks the data ones for screen readers.
 *
 * Each question still has 3 short MC options + an implicit
 * custom-text fallback the frontend draws itself.
 */

const MANDATORY_HINTS: Partial<Record<ModuleType, string>> = {
  location_single:
    "If the input mentions a single specific meeting place, you may ask 'Where exactly?' with 3 candidate place names.",
  locations_multi:
    "If the input mentions several confirmed places, you may ask 'Which places?' with 3 candidate options.",
  location_suggestions:
    "If the input clearly needs a place but the place is undecided, you may ask 'A few candidate places?' with 3 example types of venues.",
  route:
    "If the input mentions a route or journey, you may ask 'Start and end?' with 3 plausible start–end pairings.",
  phases:
    "If the input strongly implies a chronology, you may ask 'How long an arc?' or 'How many phases?' with 3 reasonable options (e.g. '3 phases', '5 phases', 'over a year').",
};

function buildSystemPrompt(): string {
  const mandatoryList = mandatoryConfigTypes();
  const mandatorySection = mandatoryList
    .map((t) => `  - ${t}: ${MANDATORY_HINTS[t] ?? MODULE_META[t].relevantWhen}`)
    .join("\n");

  return `You receive ONE short text a user wrote — a thought, an idea,
a wish, a concern, a plan. Identify 2–5 ambiguities or DATA POINTS
that, when answered, will let an agentic process build a useful
workspace from the input.

Two kinds of questions exist. Tag each with a "kind" field:

  "general" — intent / scope / commitment / audience / recurrence.
              Examples of GOOD subjects:
                  just friends or a wider circle
                  one-off or recurring
                  this week / this month / sometime
                  serious about it or just exploring
              Examples of BAD subjects:
                  surface preferences (colors, fonts, vibe)
                  confirmations of what the input already states
                  yes/no on the original input

  "data" — concrete data ONE of the mandatory-config widgets needs
           before the workspace can render. ONLY include if the input
           strongly suggests such a widget is needed.

Mandatory-config widgets (and when to ask for their data):

${mandatorySection}

Return STRICT JSON, no preamble:

  {
    "language": "<ISO 639-1 code matching input>",
    "questions": [
      {
        "id": "q1",
        "kind": "general" | "data",
        "text": "<short question, <= 100 chars>",
        "options": [
          { "value": "<short label, 1-4 words, <= 24 chars>" },
          { "value": "<short label, 1-4 words, <= 24 chars>" },
          { "value": "<short label, 1-4 words, <= 24 chars>" }
        ]
      },
      ...
    ]
  }

Hard rules:
- 2 to 5 questions. Pick only those whose answer truly matters.
- 2–8 options per question. Scale to context: if there are only 3
  meaningful answers, use 3. If the question is "which arrondissement?"
  or "which city?" or any enumerable set, list ALL relevant ones (up to
  8). Each is a SHORT label (1-4 words) in the user's language. The
  frontend always appends an implicit custom-text option — you do NOT
  generate it.
- Match the input's language for ALL strings.
- "data" questions are OPTIONAL — only include when the input clearly
  implies one of the mandatory-config widgets above. Do not force-ask
  for data when the input is too abstract.
- A workspace can have at most one "data" question per mandatory
  widget type. Don't ask the same kind of data twice.
- "id" values: q1, q2, q3, q4, q5.

Output ONLY the JSON object.`;
}

export type ClarifyQuestionKind = "general" | "data";

export interface ClarifyQuestion {
  id: string;
  kind: ClarifyQuestionKind;
  text: string;
  options: { value: string }[];
}

export interface ClarifyResult {
  language: string;
  questions: ClarifyQuestion[];
}

const MAX_INPUT_CHARS = 1200;

function prep(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_INPUT_CHARS);
}

export async function clarifyInput(text: string): Promise<ClarifyResult> {
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
      { role: "user", content: input },
    ],
  });
  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("clarify_unparseable");
  }

  const language = typeof parsed.language === "string"
    ? parsed.language.trim().slice(0, 8).toLowerCase()
    : "en";

  const rawQs = Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions: ClarifyQuestion[] = [];
  for (let i = 0; i < rawQs.length && questions.length < 5; i++) {
    const q = rawQs[i];
    if (!q || typeof q !== "object") continue;
    const qr = q as Record<string, unknown>;
    const text = typeof qr.text === "string"
      ? qr.text.trim().replace(/\s+/g, " ").slice(0, 140)
      : "";
    if (!text) continue;
    const kindRaw = typeof qr.kind === "string" ? qr.kind.trim().toLowerCase() : "general";
    const kind: ClarifyQuestionKind = kindRaw === "data" ? "data" : "general";
    const rawOpts = Array.isArray(qr.options) ? qr.options : [];
    const options: { value: string }[] = [];
    for (const o of rawOpts) {
      if (!o || typeof o !== "object") continue;
      const v = typeof (o as { value?: unknown }).value === "string"
        ? String((o as { value: string }).value).trim().slice(0, 36)
        : "";
      if (v) options.push({ value: v });
      if (options.length >= 10) break; // allow up to 10 contextual options
    }
    if (options.length < 2) continue;
    questions.push({
      id: `q${questions.length + 1}`,
      kind,
      text,
      options,
    });
  }
  if (questions.length < 1) throw new Error("clarify_empty");

  return { language, questions };
}
