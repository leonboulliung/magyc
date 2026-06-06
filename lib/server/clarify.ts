import OpenAI from "openai";

/**
 * Clarify — the AI generates 2–4 multiple-choice questions that
 * resolve the most consequential ambiguities in the user's input.
 *
 * Each question has 3 short options + an implicit "anders" custom-text
 * fallback (the frontend always offers a text field). The questions
 * are picked so the answer materially changes the resulting dossier —
 * not surface preferences.
 *
 * The output is shape-validated. Bad models / unparseable JSON / empty
 * results throw; the caller surfaces a clean error.
 */

const SYSTEM_PROMPT = `You receive ONE short text from a person — an idea,
a question, a wish, a concern, a plan, an observation. Your job:
identify the 2 to 4 most consequential AMBIGUITIES in their input —
the things you genuinely don't know yet, but whose answer would
change how a useful workspace gets built.

Return STRICT JSON, no preamble:

  {
    "language": "<ISO 639-1 code matching input>",
    "questions": [
      {
        "id": "q1",
        "text": "<short question, <= 80 chars>",
        "options": [
          { "value": "<short label, <= 24 chars>" },
          { "value": "<short label, <= 24 chars>" },
          { "value": "<short label, <= 24 chars>" }
        ]
      },
      ...
    ]
  }

Hard rules:
- 2 to 4 questions. Less is better than more. Pick only the questions
  whose answer truly matters.
- 3 options per question. Each option is a SHORT label (1–4 words),
  in the user's language.
- The frontend always offers an implicit "anders" custom-text option —
  you don't generate it.
- Questions target real ambiguities. Examples of GOOD targets:
    audience (just friends / a wider circle / the public)
    scope (a one-off / recurring / ongoing project)
    where (a specific place / multiple places / anywhere)
    commitment (just curious / serious about it / already decided)
    timeframe (this week / this month / sometime)
    privacy (private / shared with few / public)
- DON'T ask:
    surface preferences (colors, fonts, vibes — the AI picks those)
    confirmations (we don't need yes/no on the original input)
    things the user already specified clearly in the input
- Match the input's language for ALL strings.
- IDs are simple: "q1", "q2", "q3", "q4".

Output ONLY the JSON object.`;

export interface ClarifyQuestion {
  id: string;
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
      { role: "system", content: SYSTEM_PROMPT },
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
  for (let i = 0; i < rawQs.length && questions.length < 4; i++) {
    const q = rawQs[i];
    if (!q || typeof q !== "object") continue;
    const qr = q as Record<string, unknown>;
    const text = typeof qr.text === "string" ? qr.text.trim().replace(/\s+/g, " ").slice(0, 120) : "";
    if (!text) continue;
    const rawOpts = Array.isArray(qr.options) ? qr.options : [];
    const options: { value: string }[] = [];
    for (const o of rawOpts) {
      if (!o || typeof o !== "object") continue;
      const v = typeof (o as { value?: unknown }).value === "string"
        ? String((o as { value: string }).value).trim().slice(0, 32)
        : "";
      if (v) options.push({ value: v });
      if (options.length >= 4) break;
    }
    if (options.length < 2) continue;
    questions.push({
      id: `q${questions.length + 1}`,
      text,
      options,
    });
  }
  if (questions.length < 1) throw new Error("clarify_empty");

  return { language, questions };
}
