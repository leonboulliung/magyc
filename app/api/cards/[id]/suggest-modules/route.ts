import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { isBanned } from "@/lib/server/safety";
import { ALLOWED_MODULE_TYPES, type CardModule } from "@/lib/types";

const lastCallAt = new Map<string, number>();
const RATE_WINDOW_MS = 30_000;

/**
 * Suggest a small set of typed modules that genuinely fit THIS thing.
 *
 * The model decides WHICH of the available module types are appropriate
 * (it can pick 0-3, in any combination) and proposes empty-but-labelled
 * skeletons. The creator owns the content; the AI never invents values,
 * names, places, times, or specifics — only structure.
 *
 * Which types the model is allowed to pick from is governed by
 * ALLOWED_MODULE_TYPES (the live whitelist). Until a module type is
 * approved and shipped, the model won't suggest it.
 */
const SYSTEM_PROMPT_BASE = `You suggest AT MOST ONE typed "module" for a
plan ("thing") on a city-layer app. The creator has written a title,
description, and tags. Your job is to ABSTRACT the structure of what
they wrote and pick the SINGLE module type that would most help land
this particular plan — or zero, if nothing fits cleanly.

Return STRICT JSON only:
  { "modules": [ { ...one module } ] }
or
  { "modules": [] }

Hard rules:
- Never invent specifics — no names, no addresses, no times, no head
  counts. Only generic labels and empty skeletons.
- Choose AT MOST ONE module. A thing carries one anchoring
  verbalization at a time; if two feel useful, pick the most
  fundamental.
- An empty array is acceptable — and often correct. Don't pick a
  module just to pick one.
- Pick only from the module types listed below. Do NOT propose any
  other type.
- Each module type has a documented shape. Match it exactly.

Allowed module types (only these, nothing else):
__TYPE_DOCS__

Output ONLY the JSON object — no preamble, no prose.`;

// Per-type documentation that gets injected into the system prompt. Each
// entry tells the model the shape and the abstraction discipline.
const TYPE_DOCS: Record<CardModule["type"], string> = {
  brief:
    "- brief: a single-sentence statement of why this thing exists. " +
    "Shape: { \"type\": \"brief\", \"text\": \"<one short sentence, " +
    "<= 160 chars, abstracted from the creator's intent>\" }",
  roadmap:
    "- roadmap: 3-5 short imperative steps describing the abstract " +
    "structure of the plan, in order. Shape: { \"type\": \"roadmap\", " +
    "\"steps\": [\"Lock the location\", \"Cast the small crew\", ...] }",
  checklist:
    "- checklist: 3-6 unordered abstract to-do items. Shape: " +
    "{ \"type\": \"checklist\", \"items\": [\"Confirm host\", ...] }",
  bring:
    "- bring: 3-6 generic item categories participants would bring. " +
    "Shape: { \"type\": \"bring\", \"items\": [\"Wine\", \"Notebook\", ...] }",
  kv:
    "- kv: 2-3 short UPPERCASE label keys (LOOKS, STACK, BRING, GENRE) " +
    "fitting this vibe, each with an EMPTY value the creator fills in. " +
    "Shape: { \"type\": \"kv\", \"entries\": [ {\"key\":\"LOOKS\", " +
    "\"value\":\"\"}, ... ] }",
};

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

  // No allowed types yet → no point in calling the model. Return empty.
  if (ALLOWED_MODULE_TYPES.length === 0) {
    return NextResponse.json({ ok: true, modules: [] });
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

  const typeDocs = ALLOWED_MODULE_TYPES.map((t) => TYPE_DOCS[t]).join("\n");
  const systemPrompt = SYSTEM_PROMPT_BASE.replace("__TYPE_DOCS__", typeDocs);

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
        { role: "system", content: systemPrompt },
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
    const modules = sanitizeSuggestedModules(parsed.modules);
    return NextResponse.json({ ok: true, modules });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    return NextResponse.json({ error: "suggest_failed", detail: msg }, { status: 502 });
  }
}

// Suggested modules are sanitized with the same per-type rules as PATCH
// but allowed to be empty-skeleton (e.g. kv entries with empty value).
const ALLOWED_SET: Set<string> = new Set(ALLOWED_MODULE_TYPES);
function sanitizeSuggestedModules(raw: unknown): CardModule[] {
  if (!Array.isArray(raw)) return [];
  const out: CardModule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.type !== "string" || !ALLOWED_SET.has(rec.type)) continue;

    switch (rec.type) {
      case "brief": {
        if (typeof rec.text === "string") {
          out.push({ type: "brief", text: rec.text.trim().slice(0, 240) });
        }
        break;
      }
      case "roadmap": {
        if (Array.isArray(rec.steps)) {
          const steps: string[] = [];
          for (const s of rec.steps) {
            if (typeof s !== "string") continue;
            const v = s.trim().replace(/\s+/g, " ").slice(0, 160);
            if (v) steps.push(v);
            if (steps.length >= 5) break;
          }
          out.push({ type: "roadmap", steps });
        }
        break;
      }
      case "checklist": {
        if (Array.isArray(rec.items)) {
          const items: string[] = [];
          for (const s of rec.items) {
            if (typeof s !== "string") continue;
            const v = s.trim().slice(0, 160);
            if (v) items.push(v);
            if (items.length >= 6) break;
          }
          out.push({ type: "checklist", items });
        }
        break;
      }
      case "bring": {
        if (Array.isArray(rec.items)) {
          const items: string[] = [];
          for (const s of rec.items) {
            if (typeof s !== "string") continue;
            const v = s.trim().slice(0, 80);
            if (v) items.push(v);
            if (items.length >= 6) break;
          }
          out.push({ type: "bring", items });
        }
        break;
      }
      case "kv": {
        if (Array.isArray(rec.entries)) {
          const entries: { key: string; value: string }[] = [];
          for (const e of rec.entries) {
            if (!e || typeof e !== "object") continue;
            const er = e as Record<string, unknown>;
            if (typeof er.key !== "string") continue;
            const k = er.key.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 12);
            const v = typeof er.value === "string" ? er.value.trim().slice(0, 200) : "";
            if (k) entries.push({ key: k, value: v });
            if (entries.length >= 3) break;
          }
          out.push({ type: "kv", entries });
        }
        break;
      }
    }
    if (out.length >= 1) break; // a thing carries at most ONE module
  }
  return out;
}
