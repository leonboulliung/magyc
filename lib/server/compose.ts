import OpenAI from "openai";
import type { Primitive } from "@/lib/types";
import { ALLOWED_PRIMITIVE_TYPES } from "@/lib/types";

/**
 * The composer — turns a short input text into a small set of typed
 * primitives that frame and open the input.
 *
 * Hard rules the prompt enforces:
 *   - Match the input's language. If the input is German, every
 *     generated string is German.
 *   - Never invent specifics (names, addresses, dates, URLs).
 *   - 3 to 5 primitives. More dilutes the workspace.
 *   - "Empty slot" primitives (voices, resources, next_steps) are
 *     fine — they're where visitors fill in.
 */

const SYSTEM_PROMPT = `You receive a single short text from a person — a
thought, an idea, a question, a concern, or a plan. Your job is to
compose a small workspace that captures the input and invites others
to engage with it.

Return STRICT JSON, no preamble:

  {
    "title": "<3-8 word headline>",
    "language": "<ISO 639-1 code matching the input's language>",
    "primitives": [
      { "type": "brief", "text": "<one-sentence reframing of why this exists>" },
      ...
    ]
  }

Hard rules:
- MATCH THE INPUT'S LANGUAGE. If the input is in German, every string
  you generate (title, brief text, questions, asks, step labels) is in
  German. Same for any other language.
- 3 to 5 primitives total. Be sparse. Quality over coverage.
- Never invent specifics: no names, no addresses, no dates, no URLs.
- Each primitive's content abstracts the structure of what the user
  wrote — don't add facts they didn't say.
- "Open-slot" primitives (voices, resources, next_steps with empty
  steps) are valid and often the right move — they're where visitors
  fill in.

Allowed primitive types — pick AT MOST one of each:

- brief
  Shape: { "type": "brief", "text": "<single sentence, <= 160 chars>" }
  One sentence that reframes the input as the reason this space
  exists. Not a summary — an anchoring why.

- open_questions
  Shape: { "type": "open_questions", "questions": ["?", "?", ...] }
  2-4 genuine open questions the input raises, each <= 120 chars.
  These are questions whose answers would make the input clearer or
  more actionable. NOT generic "what do you think?" filler.

- help_needed
  Shape: { "type": "help_needed", "asks": ["...", "...", ...] }
  2-4 specific, claimable asks — what would someone DO to move
  this forward? Each is a short noun phrase, <= 60 chars
  (e.g. "Erste:r Buchvorschlag", "Ort fürs erste Treffen",
  "Foto/Doku"). Generic asks like "Help!" are not allowed.

- voices
  Shape: { "type": "voices" }
  An empty slot for visitors to weigh in (response, support,
  concern). Always empty — never populate.

- resources
  Shape: { "type": "resources", "items": [] }
  An empty slot for visitors to add links / references. ALWAYS
  empty — never invent URLs.

- next_steps
  Shape: { "type": "next_steps", "steps": ["...", "..."] }
  2-4 abstract steps that would move the input forward, each
  <= 80 chars. Generic ("step 1") is not allowed; each step must
  describe a real next action shape (e.g. "Einen Ort finden",
  "Zwei Mitstreiter:innen ansprechen"). It's also valid to leave
  steps: [] empty if the input is too early-stage to abstract
  steps without inventing.

- place
  Shape: { "type": "place", "label": "<short location label>" }
  ONLY when the input mentions a real place (a city, a neighborhood,
  an address phrase). Never invent a place. Label is verbatim from
  the input.

Choosing the set:
- Always include "brief".
- Include "open_questions" when the input has unresolved variables.
- Include "help_needed" when the input clearly needs other people
  to move forward.
- Include "voices" when the input is a question, a concern, or
  something where others' reactions matter most.
- Include "resources" when the input is the kind of thing where
  shared references / links would help.
- Include "next_steps" when the input is concrete enough to abstract
  a path forward.
- Include "place" only when there's a real place.

Output ONLY the JSON object.`;

interface ComposeResult {
  title: string;
  language: string;
  primitives: Primitive[];
}

const ALLOWED_SET = new Set<string>(ALLOWED_PRIMITIVE_TYPES);

/**
 * Call the model with the user's input and return a sanitized compose
 * result. Throws on configuration / parse / network errors; the caller
 * maps those into HTTP responses.
 */
export async function composeFromInput(
  inputText: string,
): Promise<ComposeResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("ai_not_configured");
  }
  const text = inputText.trim();
  if (text.length < 3) throw new Error("input_too_short");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text.slice(0, 1200) },
    ],
  });
  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("compose_unparseable");
  }

  const title = typeof parsed.title === "string"
    ? parsed.title.trim().replace(/\s+/g, " ").slice(0, 80)
    : "";
  const language = typeof parsed.language === "string"
    ? parsed.language.trim().slice(0, 8).toLowerCase()
    : "en";
  const primitives = sanitizePrimitives(parsed.primitives);

  return { title, language, primitives };
}

/**
 * Shape-validate each primitive, drop anything that doesn't fit a known
 * type. Caps protect against blown-up rows. Bad / stale data is dropped
 * so the UI never has to null-guard.
 */
function sanitizePrimitives(raw: unknown): Primitive[] {
  if (!Array.isArray(raw)) return [];
  const out: Primitive[] = [];
  const seenTypes = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.type !== "string" || !ALLOWED_SET.has(rec.type)) continue;
    if (seenTypes.has(rec.type)) continue; // at most one of each type
    seenTypes.add(rec.type);

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
            if (typeof q !== "string") continue;
            const v = q.trim().replace(/\s+/g, " ").slice(0, 160);
            if (v) qs.push(v);
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
            if (typeof a !== "string") continue;
            const v = a.trim().replace(/\s+/g, " ").slice(0, 80);
            if (v) asks.push(v);
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
        // The composer never populates resources; visitors do.
        out.push({ type: "resources", items: [] });
        break;
      }
      case "next_steps": {
        if (Array.isArray(rec.steps)) {
          const steps: string[] = [];
          for (const s of rec.steps) {
            if (typeof s !== "string") continue;
            const v = s.trim().replace(/\s+/g, " ").slice(0, 120);
            if (v) steps.push(v);
            if (steps.length >= 5) break;
          }
          // Empty steps is allowed — it's a slot for later.
          out.push({ type: "next_steps", steps });
        }
        break;
      }
      case "place": {
        if (typeof rec.label === "string") {
          const v = rec.label.trim().replace(/\s+/g, " ").slice(0, 80);
          if (v) out.push({ type: "place", label: v });
        }
        break;
      }
    }
    if (out.length >= 6) break;
  }
  // Always make sure brief is first if present — anchoring.
  out.sort((a, b) => (a.type === "brief" ? -1 : b.type === "brief" ? 1 : 0));
  return out;
}
