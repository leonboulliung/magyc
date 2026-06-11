import OpenAI from "openai";
import { MODULE_META, mandatoryConfigTypes } from "@/lib/modules";
import type { ClarifyStep, ClarifyPrefill, ModuleType } from "@/lib/types";

/**
 * Module types that currently have a clarify-editor on the frontend and
 * can therefore be pulled forward for interactive pre-configuration.
 * This set grows as editors are added — the mechanism itself is general.
 */
const PREFILLABLE: ReadonlySet<ModuleType> = new Set(["location_single", "phases", "date"]);

const PREFILL_GUIDE: Partial<Record<ModuleType, string>> = {
  location_single:
    "a single, exact place that matters — the model cannot drop a map pin precisely, so the user should pick it. draft: { \"query\": \"<best-guess specific venue or empty>\", \"label\": \"<short>\" }",
  phases:
    "a process/chronology central to the matter that is worth walking through explicitly before building (e.g. the steps of a scientific method, an event arc). draft: { \"phases\": [{\"label\":\"...\",\"description\":\"...\"}], \"currentPhase\": 0 }",
  date:
    "a single decisive date the whole thing hinges on. draft: { \"date\": \"YYYY-MM-DD or empty\" }",
};

/**
 * Clarify v3 — one ordered list of typed STEPS, each with a modality.
 *
 * The classifier downstream DECIDES which widgets a space uses. Clarify
 * only resolves the ambiguities and gathers the precision-sensitive
 * data that the build needs up front. It returns a single ordered list
 * where each step's `kind` is its input modality:
 *
 *   choice — multiple-choice chips. The default. Use when the answer
 *            space is enumerable and the job is to disambiguate.
 *   text   — open free-text. Use ONLY when chips would lead or reduce
 *            an open, generative answer (a mission line, naming a
 *            thing, the core in one sentence). Rare and high-value.
 *   module — pull a mandatory-config widget FORWARD so the user
 *            configures it interactively now (a map pin, a chronology,
 *            a decisive date), instead of an agent guessing later.
 *
 * The MODALITY is the discriminator — the AI picks it per step, the
 * same way the classifier picks widget types. Nothing is hardcoded.
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

  const prefillSection = [...PREFILLABLE]
    .map((t) => `  - ${t}: ${PREFILL_GUIDE[t]}`)
    .join("\n");

  return `You receive ONE short text a user wrote — a thought, an idea,
a wish, a concern, a plan. Identify 2–5 ambiguities or DATA POINTS
that, when resolved, will let an agentic process build a useful
workspace from the input.

Return them as an ordered list of STEPS. Each step has a "kind" that
is its INPUT MODALITY. Choose the modality that fits the step:

  "choice" — multiple-choice chips. THE DEFAULT. Use when the answer
             space is enumerable and the job is to disambiguate.
             Tag each choice step with a "category":
               "general" — intent / scope / commitment / audience /
                            recurrence. GOOD subjects:
                              just friends or a wider circle
                              one-off or recurring
                              this week / this month / sometime
                              serious about it or just exploring
                            BAD subjects:
                              surface preferences (colors, fonts, vibe)
                              confirmations of what the input states
                              yes/no on the original input
               "data"    — concrete data a mandatory-config widget
                            needs before the workspace can render.
                            ONLY when the input strongly implies one.

  "text"   — OPEN free-text, no chips. The RARE exception, not a
             convenience. Use ONLY when the VALUE of the answer is the
             user's own exact wording, and no small set of chips could
             stand in.

             DECISION TEST — before emitting "text", try to write 3–6
             plausible chip options for the question. If you can write
             them, it MUST be "choice". Only if any option set would
             FALSIFY or FLATTEN the answer may it be "text".

             GOOD "text" (the answer IS the phrasing):
               "Name this in your own words."
               "In one sentence, what is the heart of it?"
               "Describe the feeling you want people to leave with."
             BAD "text" (enumerable — these are CHOICE, not text):
               goals / purpose      → e.g. learn · sell · community · fun
               preferences          → e.g. vegetarian · vegan · none
               constraints / limits → e.g. budget · time · space
               audience / scale     → e.g. friends · public · invite-only
             If a question is about a goal, a preference, a constraint,
             an audience, a frequency, or a count, it is ENUMERABLE —
             use "choice". Typing is friction; default to chips.

  "module" — pull a precision-sensitive widget FORWARD so the user
             configures it interactively NOW. Propose ONLY when getting
             it exactly right early genuinely matters for THIS input.
             Choose ONLY from these types (each with its draft shape):

${prefillSection}

             Give each a "reason" (one short line in the user's
             language) and a "draft" (your best starting guess in the
             shown shape). 0–2 module steps. Do not pull one forward
             that the input doesn't clearly call for.

Mandatory-config widgets and when their data is worth a "data" choice
step or a "module" step:

${mandatorySection}

Return STRICT JSON, no preamble:

  {
    "language": "<ISO 639-1 code matching input>",
    "steps": [
      {
        "id": "s1",
        "kind": "choice",
        "category": "general",
        "text": "<short question, <= 100 chars>",
        "options": [
          { "value": "<short label, 1-4 words, <= 24 chars>" },
          { "value": "<short label, 1-4 words, <= 24 chars>" },
          { "value": "<short label, 1-4 words, <= 24 chars>" }
        ]
      },
      {
        "id": "s2",
        "kind": "text",
        "text": "<short open question, <= 100 chars>",
        "placeholder": "<short hint, optional>"
      },
      {
        "id": "s3",
        "kind": "module",
        "type": "<one module type from the list>",
        "reason": "<short, user's language>",
        "draft": { ... }
      }
    ]
  }

Hard rules:
- 2 to 5 steps total. Pick only those whose answer truly matters.
- DEFAULT to "choice". Aim for AT MOST ONE "text" step, often zero —
  only when chips would falsify the answer (the DECISION TEST above).
  "module" is 0–2 and only for precision-sensitive widgets listed above.
- "choice": 2–8 options. Scale to context: if there are only 3
  meaningful answers, use 3. If the question is enumerable ("which
  arrondissement?", "which city?"), list ALL relevant ones (up to 8).
  Each option is a SHORT label (1-4 words) in the user's language. The
  frontend always appends an implicit custom-text option — you do NOT
  generate it.
- At most one "module" step per widget type. Don't ask the same kind
  of data twice across steps.
- Match the input's language for ALL strings.
- "id" values: s1, s2, s3, s4, s5 in order.

Output ONLY the JSON object.`;
}

export interface ClarifyResult {
  language: string;
  steps: ClarifyStep[];
}

const MAX_INPUT_CHARS = 1200;
const MAX_STEPS = 5;
const MAX_MODULE_STEPS = 2;
const MAX_TEXT_STEPS = 2;

function prep(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_INPUT_CHARS);
}

/** Parse one raw choice step. Returns null if unusable. */
function parseChoice(qr: Record<string, unknown>): Omit<Extract<ClarifyStep, { kind: "choice" }>, "id"> | null {
  const text = typeof qr.text === "string"
    ? qr.text.trim().replace(/\s+/g, " ").slice(0, 140)
    : "";
  if (!text) return null;
  const catRaw = typeof qr.category === "string" ? qr.category.trim().toLowerCase() : "general";
  const category: "general" | "data" = catRaw === "data" ? "data" : "general";
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
  if (options.length < 2) return null;
  return { kind: "choice", category, text, options };
}

/** Parse one raw text step. Returns null if unusable. */
function parseText(qr: Record<string, unknown>): Omit<Extract<ClarifyStep, { kind: "text" }>, "id"> | null {
  const text = typeof qr.text === "string"
    ? qr.text.trim().replace(/\s+/g, " ").slice(0, 140)
    : "";
  if (!text) return null;
  const placeholder = typeof qr.placeholder === "string"
    ? qr.placeholder.trim().slice(0, 80)
    : undefined;
  return { kind: "text", text, placeholder, maxLength: 240 };
}

/** Parse one raw module step. Returns null if unusable. */
function parseModule(pr: Record<string, unknown>): Omit<ClarifyPrefill, "id"> | null {
  const type = typeof pr.type === "string" ? (pr.type as ModuleType) : null;
  if (!type || !PREFILLABLE.has(type)) return null;
  const reason = typeof pr.reason === "string" ? pr.reason.trim().slice(0, 140) : "";
  const draft = pr.draft && typeof pr.draft === "object" && !Array.isArray(pr.draft)
    ? (pr.draft as Record<string, unknown>)
    : {};
  return { kind: "module", type, reason, draft };
}

export async function clarifyInput(text: string): Promise<ClarifyResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");
  const input = prep(text);
  if (input.length < 3) throw new Error("input_too_short");

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 15_000,
  });
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

  // The model returns one ordered `steps` list. (Tolerate the legacy
  // shape — questions/prefills — by folding them in, so an occasional
  // stale completion still works.)
  const rawSteps: unknown[] = Array.isArray(parsed.steps)
    ? parsed.steps
    : [
        ...(Array.isArray(parsed.questions) ? parsed.questions : []),
        ...(Array.isArray(parsed.prefills)
          ? (parsed.prefills as unknown[]).map((p) =>
              p && typeof p === "object" ? { kind: "module", ...(p as object) } : p,
            )
          : []),
      ];

  // First pass: parse every step, partitioning modules out so we can
  // keep them last (the "answer quick, then configure" arc), and cap
  // each modality independently.
  const nonModule: ClarifyStep[] = [];
  const moduleSteps: ClarifyStep[] = [];
  let textCount = 0;
  const seenModuleTypes = new Set<ModuleType>();

  for (const s of rawSteps) {
    if (!s || typeof s !== "object") continue;
    const sr = s as Record<string, unknown>;
    // Infer kind: explicit, else legacy heuristics (has options → choice).
    let kind = typeof sr.kind === "string" ? sr.kind.trim().toLowerCase() : "";
    if (!kind) kind = Array.isArray(sr.options) ? "choice" : sr.type ? "module" : "";

    if (kind === "module") {
      if (moduleSteps.length >= MAX_MODULE_STEPS) continue;
      const parsedMod = parseModule(sr);
      if (!parsedMod) continue;
      if (seenModuleTypes.has(parsedMod.type)) continue; // one per type
      seenModuleTypes.add(parsedMod.type);
      moduleSteps.push({ id: "", ...parsedMod });
    } else if (kind === "text") {
      if (textCount >= MAX_TEXT_STEPS) continue;
      const parsedText = parseText(sr);
      if (!parsedText) continue;
      textCount++;
      nonModule.push({ id: "", ...parsedText });
    } else {
      // default / "choice"
      const parsedChoice = parseChoice(sr);
      if (!parsedChoice) continue;
      nonModule.push({ id: "", ...parsedChoice });
    }
    if (nonModule.length + moduleSteps.length >= MAX_STEPS) break;
  }

  // Stitch: non-module steps first (in AI order), modules last; assign
  // stable ids s1..sN over the final order.
  const steps: ClarifyStep[] = [...nonModule, ...moduleSteps]
    .slice(0, MAX_STEPS)
    .map((s, i) => ({ ...s, id: `s${i + 1}` }));

  if (steps.length < 1) throw new Error("clarify_empty");

  return { language, steps };
}
