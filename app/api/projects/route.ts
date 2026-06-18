import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { classifyInput } from "@/lib/server/classify";
import { recordAiEvent } from "@/lib/server/aiEvents";
import { sanitizeModules } from "@/lib/modules";
import { newId, newAnonToken } from "@/lib/id";
import { parseBody } from "@/lib/api/validate";

// The classifier makes two gpt-4o-mini calls + geocoding — give headroom.
export const maxDuration = 30;

/**
 * POST /api/projects — create an account-first Creator-Suite project.
 *
 * Unlike POST /api/spaces (anonymous homepage demo), this REQUIRES a Clerk
 * session and binds `owner_id` at creation, sets `stage='brief'` and the
 * chosen `segment`. The guided builder sends a few structured fields; we
 * synthesize them into a brief input and run the existing classifier with
 * the photo_shoot project mode so the space comes out as a real brief
 * (references/moodboard, shot list, deliverables, approvals, questions).
 */
const FIELD_MAX = 600;
const str = (v: unknown) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, FIELD_MAX) : "";
const promptRule = (v: unknown) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 500) : "";

function buildBriefInput(
  prompt: string,
  f: {
    client: string;
    product: string;
    goal: string;
    usage: string;
    deadline: string;
    references: string;
    scope: string;
  },
): string {
  const fieldLines: string[] = [];
  if (f.client) fieldLines.push(`Kunde/Marke: ${f.client}.`);
  if (f.product) fieldLines.push(`Produkt(e): ${f.product}.`);
  if (f.goal) fieldLines.push(`Ziel & Verwendung: ${f.goal}.`);
  if (f.usage) fieldLines.push(`Nutzungsrechte: ${f.usage}.`);
  if (f.deadline) fieldLines.push(`Termin/Deadline: ${f.deadline}.`);
  if (f.references) fieldLines.push(`Referenzen: ${f.references}.`);
  if (f.scope) fieldLines.push(`Umfang/Budget: ${f.scope}.`);

  // Prompt-first (matches the demo). A prompt and structured fields can
  // combine; with neither, fall back to a generic product-shoot seed so an
  // empty "just create one" still yields a starter brief.
  const parts: string[] = [];
  if (prompt) parts.push(prompt);
  if (fieldLines.length) parts.push((prompt ? "Eckdaten — " : "Produktshooting-Briefing. ") + fieldLines.join(" "));
  const input = parts.join(" ").trim();
  return (input || "Neues Produktshooting.").slice(0, 1200);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, z.object({
    segment: z.string().optional(),
    prompt: z.string().optional(),
    presetName: z.string().optional(),
    presetModules: z.unknown().optional(),
    presetPromptInjections: z.unknown().optional(),
    client: z.string().optional(),
    product: z.string().optional(),
    goal: z.string().optional(),
    usage: z.string().optional(),
    deadline: z.string().optional(),
    references: z.string().optional(),
    scope: z.string().optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const fields = {
    client: str(b.client),
    product: str(b.product),
    goal: str(b.goal),
    usage: str(b.usage),
    deadline: str(b.deadline),
    references: str(b.references),
    scope: str(b.scope),
  };

  // Segment is currently always product (the only guided preset). Kept as a
  // field so more presets slot in without an API change.
  const segment = str(b.segment) || "product";
  const presetName = str(b.presetName);
  const presetModules = sanitizeModules(Array.isArray(b.presetModules) ? b.presetModules.slice(0, 24) : []);
  const presetPromptInjections = Array.isArray(b.presetPromptInjections)
    ? b.presetPromptInjections.map(promptRule).filter(Boolean).slice(0, 6)
    : [];
  // Create works with a prompt, with structured fields, or with NOTHING
  // (an empty "just give me a starter project" path).
  const inputBase = buildBriefInput(str(b.prompt), fields);
  const input = [
    inputBase,
    presetName ? `Preset: ${presetName}.` : "",
    presetPromptInjections.length ? `Preset-Regeln: ${presetPromptInjections.join(" ")}` : "",
  ].filter(Boolean).join(" ").slice(0, 1200);

  let result;
  const aiStarted = Date.now();
  try {
    result = await classifyInput(input, [], presetModules, { projectMode: "photo_shoot" });
  } catch (e) {
    const err = e as { message?: string; status?: number };
    const msg = err.message || "unknown";
    console.error("[projects] classify failed:", err.status, msg);
    if (msg === "ai_not_configured")
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    return NextResponse.json({ error: "classify_failed", detail: msg.slice(0, 120) }, { status: 502 });
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  await ensureProfile(userId);

  const id = newId();
  const { error } = await admin.from("spaces").insert({
    id,
    input_text: input,
    title: result.title,
    language: result.language,
    vibe: result.vibe,
    modules: result.modules,
    labels: result.labels,
    style: result.style,
    // Account-first: bound to the photographer from creation. A token is
    // still stored so the row shape matches the anonymous path.
    anon_owner_token: newAnonToken(),
    owner_id: userId,
    visibility: null,
    stage: "brief",
    segment,
  });
  if (error) {
    console.error("[projects] insert failed:", error.message);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  await recordAiEvent({
    userId,
    spaceId: id,
    eventType: "classify",
    model: "gpt-4o-mini",
    input: {
      input,
      segment,
      presetName: presetName || null,
      presetModuleTypes: presetModules.map((m) => m.type),
      presetPromptInjections,
    },
    output: { title: result.title, moduleTypes: result.modules.map((m) => m.type) },
    metadata: {
      source: "studio_builder",
      segment,
      presetApplied: presetModules.length > 0,
      moduleCount: result.modules.length,
    },
    latencyMs: Date.now() - aiStarted,
  });

  return NextResponse.json({ ok: true, id });
}
