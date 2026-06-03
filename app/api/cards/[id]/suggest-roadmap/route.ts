import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { isBanned } from "@/lib/server/safety";

const lastCallAt = new Map<string, number>();
const RATE_WINDOW_MS = 30_000;

/**
 * Suggest 3–5 short, abstract step labels for a thing — the shape of the
 * roadmap the creator needs to make it happen. The same discipline as
 * /suggest-fields: ABSTRACT structure from what the creator already
 * wrote; do NOT invent participants, places, times, dependencies, or
 * any specific fact. The creator owns the wording and the order; AI
 * only proposes structure.
 */
const SYSTEM_PROMPT = `You suggest the abstract STEPS a creator needs to
make their plan happen. The creator has written a title, description,
and tags. Your job is to abstract the structure into 3-5 short, generic
step labels they can use as a roadmap.

Return STRICT JSON only, of the shape:
{ "steps": ["Lock the location", "Cast the small crew", "Run the shoot"] }

Rules:
- Each step is a short imperative phrase (2-8 words). Use sentence case.
- Steps cover the shape of the plan in order, from earliest to latest.
- Use generic verbs (lock / pick / draft / invite / run / share, etc.).
- Do NOT invent specifics: no names, no addresses, no dates, no head
  counts. The step says WHAT KIND of work happens, not the content.
  Bad: "Invite Anna and Marie". Good: "Invite the first guests".
  Bad: "Shoot on Sunday at 4pm". Good: "Run the shoot".
- Do NOT echo the title or description as a step.
- 3-5 steps. If the plan is so small that fewer fit honestly, return
  fewer. An empty array is acceptable when no structured roadmap helps.
- Output ONLY the JSON object — no preamble, no prose.`;

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isBanned(userId))
    return NextResponse.json({ error: "banned" }, { status: 403 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }

  const admin = supabaseAdmin();
  const { data: card } = await admin
    .from("cards")
    .select("id, owner_id, kind, title, description, tags, archived")
    .eq("id", params.id)
    .maybeSingle();

  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (card.owner_id !== userId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (card.kind !== "thing")
    return NextResponse.json({ error: "not_a_thing" }, { status: 400 });
  if (card.archived)
    return NextResponse.json({ error: "archived" }, { status: 400 });

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
    const steps = sanitizeSteps(parsed.steps);
    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    return NextResponse.json({ error: "suggest_failed", detail: msg }, { status: 502 });
  }
}

function sanitizeSteps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const cleaned = v.trim().replace(/\s+/g, " ").slice(0, 160);
    if (!cleaned) continue;
    out.push(cleaned);
    if (out.length >= 5) break;
  }
  return out;
}
