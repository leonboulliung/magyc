import OpenAI from "openai";
import { sanitizeModules } from "@/lib/modules";
import { ALL_VIBES, type Module, type Vibe } from "@/lib/types";

/**
 * The classifier — turns one short text input into a workspace plan:
 *   { title, language, vibe, modules: [...] }
 *
 * The AI's role is to CLASSIFY and PICK + CONFIGURE from a fixed
 * registry. It must NOT invent facts (no fake places, no fake
 * Wikipedia titles, no fake coordinates). All labels and the title
 * are in the input's language.
 */

const SYSTEM_PROMPT = `You receive ONE short text from a person — an idea,
a thought, a question, a wish, a concern, a plan, an observation, a
search, an offer, a decision being weighed. Your job is to design a
small collaborative workspace by PICKING modules from a fixed registry
and CONFIGURING them. You never invent facts.

Return STRICT JSON, no preamble:

  {
    "title": "<3-8 word headline, in the input's language>",
    "language": "<ISO 639-1 code matching input>",
    "vibe":     "<one of: editorial | document | dashboard | terminal | soft | minimal>",
    "modules":  [ ...3 to 7 modules from the registry below... ]
  }

Hard rules:
- MATCH THE INPUT'S LANGUAGE. Every "label", every "description", every
  module-level text string is in the input's language.
- 3 to 7 modules. Be sparse. Always include a "headline" as the first
  module.
- Never invent facts: no fake place names, no fake Wikipedia titles,
  no fake coordinates, no fake data. If the input doesn't mention a
  place, no map. If it doesn't mention a topic with a known name,
  no knowledge card.
- Every module needs a "label" (the human-visible title for that
  module, in the input's language) and may have a "description"
  (one short line).

Vibe choice:
- editorial — text-driven, reflective, formal ideas
- document  — notes, memos, structured thinking
- dashboard — numbers, comparisons, tracking
- terminal  — technical, urgent, raw
- soft      — personal, calm, creative
- minimal   — default when nothing else fits

Module registry — pick from these types only:

1. headline
   { "type":"headline", "label":"…", "title":"…", "subtitle":"…" }
   Always the first module. Title is the workspace anchor.

2. tags
   { "type":"tags", "label":"…", "tags":["…","…"] }
   2-5 lowercased keywords/themes.

3. notes
   { "type":"notes", "label":"…", "text":"" }
   Open collaborative text. Start empty unless the input clearly
   includes notes worth seeding.

4. open_question
   { "type":"open_question", "label":"…", "prompt":"…?" }
   One genuine question the input raises.

5. poll
   { "type":"poll", "label":"…", "question":"…", "options":["…","…","…"] }
   2-4 options. Use when there's a real choice to settle.

6. checklist
   { "type":"checklist", "label":"…", "items":[{"text":"…"}] }
   2-6 concrete to-do items if the input implies them.

7. help_slots
   { "type":"help_slots", "label":"…", "slots":[{"label":"…"}] }
   2-5 specific, claimable asks (each a short noun phrase).

8. stages
   { "type":"stages", "label":"…", "stages":["…","…","…"], "current":0 }
   2-6 sequential phases. Set current to a sensible starting point.

9. number_block
   { "type":"number_block", "label":"…", "value":"…", "caption":"…" }
   One quantitative anchor (e.g. "6 Leute", "3 Wochen", "120 km²").
   Only if the input contains or strongly implies the number.

10. icon
    { "type":"icon", "label":"…", "iconify":"set:name", "size":48 }
    Use Iconify set:name format. Prefer "lucide:" or "phosphor:" sets.
    Example: "lucide:book-open".

11. palette
    { "type":"palette", "label":"…", "hue":"blue", "steps":[3,6,9] }
    Open Props palette. Hue is a single word: blue|red|amber|green|
    purple|pink|cyan|orange|gray|teal|lime|indigo|violet|fuchsia|
    rose|stone|slate|zinc.

12. map
    { "type":"map", "label":"…", "center":[lng,lat], "zoom":11,
      "markers":[{"lng":…,"lat":…,"label":"…"}] }
    ONLY when the input mentions a real city / neighborhood / region.
    Use approximate, well-known coordinates. If unsure, omit.

13. time
    { "type":"time", "label":"…", "mode":"date|countdown|timeline",
      "date":"YYYY-MM-DD", "entries":[{"date":"…","label":"…"}],
      "timezone":"Europe/Berlin" }
    "date"/"countdown" need a date; "timeline" needs entries.
    Only if the input mentions a specific time or relative time
    that resolves cleanly. If unsure, omit.

14. knowledge
    { "type":"knowledge", "label":"…", "topic":"<exact Wikipedia
      article title>", "source":"wikipedia", "show":["summary","thumb"] }
    Topic MUST be an exact, well-known Wikipedia title in English
    (the renderer queries the en.wikipedia.org REST API). Add an
    attribution: { name:"Wikipedia", url:"https://en.wikipedia.org",
    license:"CC-BY-SA 4.0" }.
    Only include if the input mentions a named topic with a known
    Wikipedia article.

15. framework
    { "type":"framework", "label":"…", "kind":"okr|scqa|eisenhower|
      rice|kanban|adr|rfc|postmortem|faq|one_pager",
      "prefill":{ "<slotName>": "<value in input's language>" } }
    Pick the kind whose slots make sense for the input. Prefill the
    slots you can. Slot names per kind:
      okr        : objective, kr1, kr2, kr3
      scqa       : situation, complication, question, answer
      eisenhower : (no prefill — visitors fill)
      rice       : reach, impact, confidence, effort
      kanban     : (no prefill)
      adr        : context, decision, consequences
      rfc        : summary, motivation, design
      postmortem : impact, root_cause, lessons
      faq        : (no prefill — slots are q1,a1,q2,a2,…)
      one_pager  : problem, proposal, success

16. typography
    { "type":"typography", "label":"…", "heading":"Inter",
      "body":"Inter" }
    Optional. Use only when the workspace would meaningfully benefit
    from a font sample (rare). Stick to Google Fonts family names.

17. formula
    { "type":"formula", "label":"…", "latex":"E = mc^2",
      "display":"block" }
    Only when the input directly involves a formula.

18. chart
    { "type":"chart", "label":"…", "chartType":"bar|line|area",
      "data":[{"x":"…","y":0}, {"x":"…","y":0}],
      "xLabel":"…", "yLabel":"…" }
    Only when the input CONTAINS real numbers that compare or trend.
    Never invent values.

19. image
    { "type":"image", "label":"…", "url":"https://…",
      "alt":"…",
      "attribution":{"name":"Wikimedia Commons","url":"…","license":"CC-BY-SA 4.0"} }
    Only when the input has a strong visual subject AND you know a
    real Wikimedia Commons URL. If unsure, omit.

Output ONLY the JSON object.`;

export interface ClassifyResult {
  title: string;
  language: string;
  vibe: Vibe;
  modules: Module[];
}

const VIBE_SET = new Set<string>(ALL_VIBES);

/** Lightly trim + cap input. */
function prepInput(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 1200);
}

export async function classifyInput(text: string): Promise<ClassifyResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");
  const input = prepInput(text);
  if (input.length < 3) throw new Error("input_too_short");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: input },
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

  // Ensure a headline is first — drop any leading non-headline if the
  // first valid module is a headline elsewhere; otherwise inject a
  // minimal headline from the title.
  const headIdx = modules.findIndex((m) => m.type === "headline");
  if (headIdx > 0) {
    const [h] = modules.splice(headIdx, 1);
    modules.unshift(h);
  } else if (headIdx === -1 && title) {
    modules.unshift({
      type: "headline",
      label: title,
      title,
    });
  }

  return { title, language, vibe, modules };
}
