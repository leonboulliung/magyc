import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";

// Same rate-limit posture as /draft: 30 seconds between calls per user.
// Owner-only, things-only, so the surface is already narrow.
const lastCallAt = new Map<string, number>();
const RATE_WINDOW_MS = 30_000;

/**
 * Suggest 2–3 custom-field keys that suit the particular thing — a
 * shoot's "LOOKS", a hackathon's "STACK", a dinner's "BRING".
 *
 * Hard rule: the AI ABSTRACTS what the creator already wrote. It does NOT
 * invent specifics — no example values, no implied participants, no extra
 * facts. It only proposes structured slots that fit the thing's vibe, so
 * the creator can fill them in themselves.
 */
const SYSTEM_PROMPT = `You suggest small structured-detail SLOTS for a
plan ("thing") on a city-layer app. The creator has already written a
title, description, and tags. Your job is NOT to invent any new facts —
your job is to abstract the structure of this kind of thing and propose
2-3 short label keys the creator can fill in.

Return STRICT JSON only, of the shape:
{
  "fields": ["LABEL_1", "LABEL_2", "LABEL_3"]
}

Rules:
- Keys are short uppercase labels (3-12 chars). Examples that fit
  different vibes: LOOKS, REFS, WARDROBE, STACK, TRACK, BRING, DIET,
  PLAYLIST, GENRE, GEAR, MOOD, DRESS-CODE.
- Choose 2 to 3 keys that genuinely fit THIS kind of thing — not
  generic ones. A photo shoot doesn't want STACK; a hackathon doesn't
  want LOOKS.
- Use hyphens for two-word labels: DRESS-CODE, RUN-LENGTH. No spaces,
  no punctuation other than hyphen.
- Do NOT invent values, examples, or any sentences. Only the labels.
- Do NOT echo the title, tags, or description back as a label.
- If nothing fits cleanly, return fewer labels. An empty array is
  acceptable when the thing is so generic that no slot would help.
- Output ONLY the JSON object — no preamble, no prose.`;

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }

  const admin = supabaseAdmin();

  // Pull just enough context to brief the model. Owner check is gate #1.
  const { data: card } = await admin
    .from("cards")
    .select("id, owner_id, title, description, tags")
    .eq("id", params.id)
    .maybeSingle();

  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (card.owner_id !== userId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const now = Date.now();
  const last = lastCallAt.get(userId) || 0;
  if (now - last < RATE_WINDOW_MS) {
    const retryIn = Math.ceil((RATE_WINDOW_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: "rate_limited", retryInSeconds: retryIn },
      { status: 429 },
    );
  }
  lastCallAt.set(userId, now);

  const tags = Array.isArray(card.tags) ? card.tags.slice(0, 8) : [];
  const userPayload = [
    `TITLE: ${String(card.title || "").slice(0, 200)}`,
    `DESCRIPTION: ${String(card.description || "").slice(0, 600) || "(none)"}`,
    `TAGS: ${tags.length ? tags.join(", ") : "(none)"}`,
  ].join("\n");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "suggest_unparseable" }, { status: 500 });
    }
    const fields = sanitizeFields(parsed.fields);
    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    return NextResponse.json({ error: "suggest_failed", detail: msg }, { status: 502 });
  }
}

const LABEL_RE = /^[A-Z][A-Z0-9-]{1,11}$/;

function sanitizeFields(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const cleaned = v.trim().toUpperCase().replace(/\s+/g, "-");
    if (!LABEL_RE.test(cleaned)) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= 3) break;
  }
  return out;
}
