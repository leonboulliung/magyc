import OpenAI from "openai";
import type { CardModule, CardSignature } from "@/lib/types";

/**
 * Compute a design signature for a card from its semantic context.
 *
 * The signature is a small bundle of typed parameters the app's
 * existing surfaces consume — type weight, palette, pin rhythm, map
 * warmth — to tune themselves toward the mood of this thing.
 *
 * The model never returns artwork. It returns the tuning knobs the
 * editorial system already has, projected onto the abstract axes of
 * mood / energy / chromatic temperature.
 *
 * Returns null on AI failure; callers fall back to defaults.
 */

const SYSTEM_PROMPT = `You compute a SIGNATURE for a city event card.
The signature is a small bundle of design parameters the app uses to
tune its existing visuals — type weight, color palette, pin pulse
rhythm, map warmth — toward the mood of this particular thing.

Return STRICT JSON only:
{
  "palette": ["#hex", "#hex"],
  "warmth": 0.0-1.0,
  "tempo": 0.0-1.0,
  "weight": 100-900,
  "geometry": "round" | "sharp" | "soft" | "linear",
  "density": 0.0-1.0,
  "kinetic": 0.0-1.0
}

How to map mood onto axes:

- palette: TWO harmonious 6-digit hex colors. First is the primary
  accent (the chromatic center of the mood). Second is a softer
  complement (often a desaturated tint of the first, or an adjacent
  hue). Quiet things = quiet colors. Loud things = saturated colors.
  Both colors should print well on white paper.

- warmth: how chromatically warm the event feels (cooking = 0.85,
  ice bath = 0.05, bookshop reading = 0.55, hackathon = 0.45).

- tempo: pulse rate (slow dinner = 0.25, walks = 0.4,
  hackathon = 0.85, meditation = 0.1, dance = 0.9).

- weight: editorial type weight axis (declarative / loud = 800-900,
  intimate / contemplative = 500-700). Stay in the editorial register.

- geometry: visual shape language. round = warm / social / round-table
  vibes. sharp = technical / brutalist / hacker. soft = intimate /
  domestic. linear = structured / walks / sequence.

- density: surface filling rhythm (a packed festival = 0.85,
  a quiet picnic = 0.25).

- kinetic: motion intensity (active running = 0.85, still meditation
  = 0.1, conversation = 0.45).

Do NOT invent specifics. Read the title, description, tags, and module
to project the mood onto these abstract axes. Always return both
palette colors. Numbers must be in range. Output ONLY the JSON
object — no preamble, no prose.`;

function describeModule(m: CardModule | undefined): string {
  if (!m) return "(none)";
  switch (m.type) {
    case "brief":     return `brief: "${m.text.slice(0, 200)}"`;
    case "roadmap":   return `roadmap: ${m.steps.length} steps`;
    case "checklist": return `checklist: ${m.items.length} items`;
    case "bring":     return `bring: ${m.items.join(", ").slice(0, 200)}`;
    case "kv":        return `kv: ${m.entries.map((e) => `${e.key}=${e.value}`.slice(0, 60)).join(" · ").slice(0, 240)}`;
    case "moodboard": return `moodboard: ${m.refs.length} refs`;
    case "setlist":   return `setlist: ${m.items.map((i) => i.title).join(", ").slice(0, 200)}`;
    case "reflist":   return `reflist: ${m.items.length} links`;
  }
}

export async function computeSignature({
  title,
  description,
  tags,
  module,
}: {
  title: string;
  description: string;
  tags: string[];
  module?: CardModule;
}): Promise<CardSignature | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const userPayload = [
    `TITLE: ${title.slice(0, 200)}`,
    `DESCRIPTION: ${description.slice(0, 600) || "(none)"}`,
    `TAGS: ${tags.length ? tags.slice(0, 8).join(", ") : "(none)"}`,
    `MODULE: ${describeModule(module)}`,
  ].join("\n");

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return sanitizeSignature(parsed);
  } catch {
    return null;
  }
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const GEOMETRY_SET = new Set(["round", "sharp", "soft", "linear"]);

function sanitizeSignature(raw: Record<string, unknown>): CardSignature | null {
  const pal = raw.palette;
  if (!Array.isArray(pal) || pal.length < 2) return null;
  const p0 = typeof pal[0] === "string" && HEX_RE.test(pal[0]) ? (pal[0] as string).toLowerCase() : null;
  const p1 = typeof pal[1] === "string" && HEX_RE.test(pal[1]) ? (pal[1] as string).toLowerCase() : null;
  if (!p0 || !p1) return null;

  const clamp01 = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
  const warmth = clamp01(raw.warmth);
  const tempo = clamp01(raw.tempo);
  const density = clamp01(raw.density);
  const kinetic = clamp01(raw.kinetic);
  const w = raw.weight;
  const weight =
    typeof w === "number" && Number.isFinite(w)
      ? Math.max(100, Math.min(900, Math.round(w)))
      : 900;
  const g = raw.geometry;
  const geometry =
    typeof g === "string" && GEOMETRY_SET.has(g)
      ? (g as CardSignature["geometry"])
      : "round";

  return { palette: [p0, p1], warmth, tempo, weight, geometry, density, kinetic };
}

/**
 * Fire-and-forget: spawn the signature compute as a background task
 * after a POST / PATCH responds. Failures are silent; the card just
 * stays with whatever signature it had before.
 */
export function regenerateSignatureInBackground(
  cardId: string,
  context: Parameters<typeof computeSignature>[0],
  updateFn: (cardId: string, signature: CardSignature) => Promise<unknown>,
): void {
  void (async () => {
    try {
      const sig = await computeSignature(context);
      if (sig) await updateFn(cardId, sig);
    } catch {
      /* silent: the card stays with its previous signature */
    }
  })();
}
