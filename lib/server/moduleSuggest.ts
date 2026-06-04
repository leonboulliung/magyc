import OpenAI from "openai";
import { ALLOWED_MODULE_TYPES, type CardModule } from "@/lib/types";

/**
 * Shared "suggest a module" plumbing — the prompt + sanitizer used by
 * both `/api/cards/[id]/suggest-modules` (an existing card) and
 * `/api/cards/suggest-modules-draft` (a draft before POST). The two
 * routes differ only in how they authenticate / load context.
 *
 * The model is allowed to pick AT MOST ONE module type from
 * ALLOWED_MODULE_TYPES (or return an empty array when nothing fits).
 * It must never invent specifics — names, addresses, times, URLs.
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
  moodboard:
    "- moodboard: an EMPTY skeleton inviting the creator to drop in " +
    "their own image-reference URLs (Pinterest, Are.na, etc.). Never " +
    "invent URLs. Shape: { \"type\": \"moodboard\", \"refs\": [] } " +
    "— always an empty array.",
  setlist:
    "- setlist: 3-5 GENERIC ordered programme beats — the chunks of " +
    "the event, in order, without specific times or names. The creator " +
    "adds the real titles + times. Shape: { \"type\": \"setlist\", " +
    "\"items\": [{\"title\": \"Opening drink\"}, {\"title\": \"First " +
    "course\"}, ...] }. Do NOT invent times.",
  reflist:
    "- reflist: an EMPTY skeleton for the creator to add their own " +
    "external links + captions. Never invent URLs. Shape: " +
    "{ \"type\": \"reflist\", \"items\": [] } — always an empty array.",
};

const ALLOWED_SET: Set<string> = new Set(ALLOWED_MODULE_TYPES);

/**
 * Lenient sanitizer for AI suggestions — accepts empty user-fillable
 * skeletons (e.g. kv entries with empty values, moodboard with no refs)
 * because those are exactly the slots the creator is meant to flesh
 * out. Stricter sanitize-on-save lives in lib/server/moduleSanitize.
 */
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
      case "moodboard": {
        out.push({ type: "moodboard", refs: [] });
        break;
      }
      case "setlist": {
        if (Array.isArray(rec.items)) {
          const items: { time?: string; title: string }[] = [];
          for (const it of rec.items) {
            if (!it || typeof it !== "object") continue;
            const ir = it as Record<string, unknown>;
            if (typeof ir.title !== "string") continue;
            const t = ir.title.trim().slice(0, 120);
            if (!t) continue;
            items.push({ title: t });
            if (items.length >= 5) break;
          }
          out.push({ type: "setlist", items });
        }
        break;
      }
      case "reflist": {
        out.push({ type: "reflist", items: [] });
        break;
      }
    }
    if (out.length >= 1) break;
  }
  return out;
}

/**
 * Call the model with a Title + Description + Tags context and return
 * a sanitized list of suggested modules (0 or 1). Throws on
 * configuration / parse / network errors; the caller maps those into
 * HTTP responses.
 */
export async function suggestModulesFromContext({
  title,
  description,
  tags,
}: {
  title: string;
  description: string;
  tags: string[];
}): Promise<CardModule[]> {
  if (ALLOWED_MODULE_TYPES.length === 0) return [];
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("ai_not_configured");
  }

  const typeDocs = ALLOWED_MODULE_TYPES.map((t) => TYPE_DOCS[t]).join("\n");
  const systemPrompt = SYSTEM_PROMPT_BASE.replace("__TYPE_DOCS__", typeDocs);

  const userPayload = [
    `TITLE: ${title.slice(0, 200)}`,
    `DESCRIPTION: ${description.slice(0, 600) || "(none)"}`,
    `TAGS: ${tags.length ? tags.slice(0, 8).join(", ") : "(none)"}`,
  ].join("\n");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
    throw new Error("suggest_unparseable");
  }
  return sanitizeSuggestedModules(parsed.modules);
}
