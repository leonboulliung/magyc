import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clarifyInput } from "@/lib/server/clarify";
import { recordAiEvent } from "@/lib/server/aiEvents";
import { parseBody } from "@/lib/api/validate";
import { supabaseAdmin } from "@/lib/supabase";
import { takePersistentRateLimit } from "@/lib/server/uploadSecurity";

const lastCallAt = new Map<string, number>();
const RATE_WINDOW_MS = 15_000;
const MAX_INPUT_CHARS = 1200;

/**
 * POST /api/spaces/clarify — first leg of the create flow.
 *
 *   Body: { input: string, anonToken?: string }
 *
 * Returns 2–4 multiple-choice clarification questions. The frontend
 * collects answers and POSTs them with the original input to
 * /api/spaces.
 *
 * No space row is created here — the input + answers stay in client
 * memory until the user is ready to commit.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  const parsed = await parseBody(req, z.object({
    input: z.string().optional(),
    projectMode: z.string().optional().nullable(),
    anonToken: z.string().optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const input = (body.input || "").trim();
  if (input.length < 3) return NextResponse.json({ error: "input_too_short" }, { status: 400 });
  if (input.length > MAX_INPUT_CHARS) {
    return NextResponse.json({ error: "input_too_long" }, { status: 400 });
  }

  const key = typeof body.anonToken === "string" && body.anonToken.length >= 16
    ? body.anonToken.slice(0, 64)
    : input.slice(0, 32); // fallback: rate-limit by content

  const now = Date.now();
  const last = lastCallAt.get(key) || 0;
  if (now - last < RATE_WINDOW_MS) {
    const retryIn = Math.ceil((RATE_WINDOW_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: "rate_limited", retryInSeconds: retryIn },
      { status: 429 },
    );
  }
  lastCallAt.set(key, now);

  try {
    const admin = supabaseAdmin();
    const allowed = await takePersistentRateLimit(admin, `ai-clarify:${userId || key}`, 60 * 60, 80);
    if (!allowed) return NextResponse.json({ error: "rate_limited", retryInSeconds: 60 }, { status: 429 });
  } catch {
    // Clarify can still run when observability/rate-limit storage is not ready.
  }

  const started = Date.now();
  try {
    const result = await clarifyInput(input, { projectMode: body.projectMode });
    await recordAiEvent({
      userId,
      anonId: typeof body.anonToken === "string" ? body.anonToken.slice(0, 64) : null,
      eventType: "clarify",
      model: "gpt-4o-mini",
      input,
      output: {
        language: result.language,
        comingToLife: result.comingToLife,
        steps: result.steps.map((step) => ({ id: step.id, kind: step.kind })),
      },
      metadata: { projectMode: body.projectMode ?? null, stepCount: result.steps.length },
      latencyMs: Date.now() - started,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    await recordAiEvent({
      userId,
      anonId: typeof body.anonToken === "string" ? body.anonToken.slice(0, 64) : null,
      eventType: "clarify",
      model: "gpt-4o-mini",
      status: "error",
      input,
      error: msg,
      metadata: { projectMode: body.projectMode ?? null },
      latencyMs: Date.now() - started,
    });
    if (msg === "ai_not_configured")
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    if (msg === "clarify_unparseable")
      return NextResponse.json({ error: "clarify_unparseable" }, { status: 500 });
    if (msg === "clarify_empty")
      return NextResponse.json({ error: "clarify_empty" }, { status: 500 });
    return NextResponse.json({ error: "clarify_failed", detail: msg }, { status: 502 });
  }
}
