import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { composeFromInput } from "@/lib/server/compose";
import { newId } from "@/lib/id";

const lastCallAt = new Map<string, number>();
const RATE_WINDOW_MS = 30_000;
const MAX_INPUT_CHARS = 1200;

/**
 * POST /api/spaces — create a new space from a single input text.
 *
 *   Body: { input: string }
 *
 * The composer runs synchronously: we want the new URL to land on a
 * fully-formed workspace. (gpt-4o-mini round-trip is ~1–3s — within
 * the budget for a one-shot create flow.)
 *
 * Rate-limit: 1 / 30s / user. Process-local map; fine for our volumes.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { input?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const input = (body.input || "").trim();
  if (input.length < 3) {
    return NextResponse.json({ error: "input_too_short" }, { status: 400 });
  }
  if (input.length > MAX_INPUT_CHARS) {
    return NextResponse.json({ error: "input_too_long" }, { status: 400 });
  }

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

  await ensureProfile(userId);

  // Compose the workspace.
  let composed;
  try {
    composed = await composeFromInput(input);
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    if (msg === "ai_not_configured")
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    if (msg === "compose_unparseable")
      return NextResponse.json({ error: "compose_unparseable" }, { status: 500 });
    return NextResponse.json({ error: "compose_failed", detail: msg }, { status: 502 });
  }

  const id = newId();
  const admin = supabaseAdmin();
  const { error } = await admin.from("spaces").insert({
    id,
    owner_id: userId,
    input_text: input,
    title: composed.title,
    language: composed.language,
    primitives: composed.primitives,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
