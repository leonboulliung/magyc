import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { classifyInput } from "@/lib/server/classify";
import { recordAiEvent } from "@/lib/server/aiEvents";
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

function buildBriefInput(f: {
  client: string;
  product: string;
  goal: string;
  usage: string;
  deadline: string;
  references: string;
  scope: string;
}): string {
  const lines: string[] = ["Produktshooting-Briefing."];
  if (f.client) lines.push(`Kunde/Marke: ${f.client}.`);
  if (f.product) lines.push(`Produkt(e): ${f.product}.`);
  if (f.goal) lines.push(`Ziel & Verwendung: ${f.goal}.`);
  if (f.usage) lines.push(`Nutzungsrechte: ${f.usage}.`);
  if (f.deadline) lines.push(`Termin/Deadline: ${f.deadline}.`);
  if (f.references) lines.push(`Referenzen: ${f.references}.`);
  if (f.scope) lines.push(`Umfang/Budget: ${f.scope}.`);
  return lines.join(" ").slice(0, 1200);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, z.object({
    segment: z.string().optional(),
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
  // Need at least a product or a goal to author a meaningful brief.
  if (!fields.product && !fields.goal) {
    return NextResponse.json({ error: "need_product_or_goal" }, { status: 400 });
  }

  // Segment is currently always product (the only guided preset). Kept as a
  // field so more presets slot in without an API change.
  const segment = str(b.segment) || "product";
  const input = buildBriefInput(fields);

  let result;
  const aiStarted = Date.now();
  try {
    result = await classifyInput(input, [], [], { projectMode: "photo_shoot" });
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAiEvent({
    userId,
    spaceId: id,
    eventType: "classify",
    model: "gpt-4o-mini",
    input: { input, segment },
    output: { title: result.title, moduleTypes: result.modules.map((m) => m.type) },
    metadata: { source: "studio_builder", segment, moduleCount: result.modules.length },
    latencyMs: Date.now() - aiStarted,
  });

  return NextResponse.json({ ok: true, id });
}
