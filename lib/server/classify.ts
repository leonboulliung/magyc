import OpenAI from "openai";
import { sanitizeModules } from "@/lib/modules";
import { ALL_VIBES, type Module, type Vibe } from "@/lib/types";

/**
 * Classifier v3.1 — the "dossier author" pass.
 *
 * Input arrives WITH clarification answers from the prior clarify step.
 * The classifier no longer needs to guess audience, scope, timeframe,
 * privacy, where, commitment — it has them. Its job is to assemble a
 * grounded workspace where every module is FULLY AUTHORED.
 *
 * Key differences from v3.0:
 *   - Receives input + answers (a small object) instead of just input
 *   - Always produces a `synthesis` module (the AI's reflection
 *     paragraph) right after the headline
 *   - Modules NEVER ship empty — no empty notes, no half-baked
 *     framework, no checklist with one item
 *   - Labels are SPECIFIC to the input ("Was dich noch zögern lässt"),
 *     never generic ("Offene Frage")
 *   - Tags / notes / checklist items are read-only authoring by the
 *     AI — visitors only react (vote, claim, respond, tick)
 */

const SYSTEM_PROMPT = `You build a small "dossier" workspace for a person
who described something — an idea, a question, a wish, a concern, a
plan. You receive their original text AND their answers to 2–4
clarification questions. Use those as ANCHORS — never invent facts
beyond what the text or answers told you.

Return STRICT JSON, no preamble:

  {
    "title":   "<3-8 word headline, in input's language>",
    "language":"<ISO 639-1 code matching input>",
    "vibe":    "<one of: editorial | document | dashboard | terminal | soft | minimal>",
    "modules": [ ...3 to 6 modules from the registry below... ]
  }

Hard rules:
- MATCH THE INPUT'S LANGUAGE. Every label, every text field, every
  option string is in the language of the input.
- ALWAYS first module: "headline" (title + optional subtitle).
- ALWAYS second module: "synthesis" — your 2–4 sentence reflection
  of what you understood, written in second person ("Du willst…",
  "Du fragst dich…"). This is the user reading back what the app
  understood. It MUST be specific to their input, not generic.
- 3 to 6 modules total. Sparse > dense.
- Every module must come FULLY AUTHORED. Visitors cannot type new
  items — only react. So:
    notes      → ship with 2–4 sentences of seeded prose
    tags       → 3–6 specific tags
    checklist  → 3–6 concrete action items
    help_slots → 2–5 specific, named asks
    poll       → real options that matter to the decision
    open_question → a specific question only the input could raise
    stages     → 3–6 concrete phase names
- Module LABELS are SPECIFIC to the input. Examples:
    not "Notizen" but "Was hinter der Idee steckt"
    not "Offene Frage" but "Womit hier alles steht und fällt"
    not "Hilfe-Slots" but "Wer was übernehmen müsste"
    not "Phasen" but "Wie sich das entfaltet"
- Never invent facts. No fake place names, no fake Wikipedia titles,
  no fake coordinates, no fake numbers.

Allowed module types (pick 3–6, headline + synthesis are mandatory):

1. headline           { type, label, title, subtitle? }
2. synthesis          { type, label, text }              ← always second
3. tags               { type, label, tags:["…","…"] }
4. notes              { type, label, text:"<seeded prose>" }
5. open_question      { type, label, prompt:"…?" }
6. poll               { type, label, question, options:["…","…"] }
7. checklist          { type, label, items:[{text:"…"}] }
8. help_slots         { type, label, slots:[{label:"…"}] }
9. stages             { type, label, stages:["…"], current:0 }
10. number_block      { type, label, value, caption }
11. icon              { type, label, iconify:"lucide:book-open", size:64 }
12. palette           { type, label, hue:"blue", steps:[3,6,9] }
13. map               { type, label, center:[lng,lat], zoom:11,
                         markers:[{lng,lat,label}] }
14. time              { type, label, mode:"date|countdown|timeline",
                         date:"YYYY-MM-DD", entries:[{date,label}],
                         timezone:"Europe/Berlin" }
15. knowledge         { type, label, topic:"<exact Wikipedia title>",
                         source:"wikipedia", show:["summary","thumb"],
                         attribution:{name:"Wikipedia",
                           url:"https://en.wikipedia.org",
                           license:"CC-BY-SA 4.0"} }
16. framework         { type, label, kind:"okr|scqa|eisenhower|rice|
                         kanban|adr|rfc|postmortem|faq|one_pager",
                         prefill:{ "<slotName>":"<value>" } }
17. typography        { type, label, heading, body }
18. formula           { type, label, latex, display:"inline|block" }
19. chart             { type, label, chartType:"bar|line|area",
                         data:[{x,y}], xLabel, yLabel }
20. image             { type, label, url, alt,
                         attribution:{name,url,license} }

Framework slot names per kind:
  okr        : objective, kr1, kr2, kr3
  scqa       : situation, complication, question, answer
  eisenhower : urgent_important, important, urgent, neither
  rice       : reach, impact, confidence, effort
  kanban     : todo, doing, done
  adr        : context, decision, consequences
  rfc        : summary, motivation, design
  postmortem : impact, root_cause, lessons
  faq        : q1, a1, q2, a2
  one_pager  : problem, proposal, success

Always prefill what you can; don't leave a framework empty. If you'd
have to leave half its slots empty, pick a different module instead.

Vibe choice:
- editorial — text-driven, reflective, formal ideas
- document  — notes, memos, structured thinking
- dashboard — numbers, comparisons, tracking
- terminal  — technical, urgent, raw
- soft      — personal, calm, creative
- minimal   — default when nothing else fits

Output ONLY the JSON object.`;

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
}

const VIBE_SET = new Set<string>(ALL_VIBES);

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
      { role: "system", content: SYSTEM_PROMPT },
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

  // Enforce ordering of the header zone: heading → rich_text → tags →
  // everything else. The prompt rewrite (Phase 0 Commit B) will make
  // this a hard requirement on the AI side; for now we sort defensively
  // and inject a heading from the title if the AI didn't produce one.
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

  return { title, language, vibe, modules: ordered };
}
