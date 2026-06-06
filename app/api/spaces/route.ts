import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { classifyInput } from "@/lib/server/classify";
import { newAnonToken, newId } from "@/lib/id";

const lastCallAt = new Map<string, number>();
const RATE_WINDOW_MS = 30_000;
const MAX_INPUT_CHARS = 1200;

/**
 * POST /api/spaces — create a new space from text input.
 *
 *   Body: { input: string, anonToken?: string }
 *
 * Anonymous-by-default: no Clerk sign-in required. If the client
 * already has an anon token (from localStorage), it sends it; we use
 * it as the rate-limit key and as the owner token. If it doesn't, we
 * mint one and return it.
 *
 * On success: { ok, id, anonOwnerToken }
 * The client stores anonOwnerToken in localStorage keyed by the new
 * space id. Without it, the creator can't edit their own draft.
 */
export async function POST(req: Request) {
  let body: { input?: string; anonToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const input = (body.input || "").trim();
  if (input.length < 3) return NextResponse.json({ error: "input_too_short" }, { status: 400 });
  if (input.length > MAX_INPUT_CHARS) {
    return NextResponse.json({ error: "input_too_long" }, { status: 400 });
  }

  const anonToken = typeof body.anonToken === "string" && body.anonToken.length >= 16
    ? body.anonToken.slice(0, 64)
    : newAnonToken();

  const now = Date.now();
  const last = lastCallAt.get(anonToken) || 0;
  if (now - last < RATE_WINDOW_MS) {
    const retryIn = Math.ceil((RATE_WINDOW_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: "rate_limited", retryInSeconds: retryIn },
      { status: 429 },
    );
  }
  lastCallAt.set(anonToken, now);

  let result;
  try {
    result = await classifyInput(input);
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    if (msg === "ai_not_configured")
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    if (msg === "classify_unparseable")
      return NextResponse.json({ error: "classify_unparseable" }, { status: 500 });
    return NextResponse.json({ error: "classify_failed", detail: msg }, { status: 502 });
  }

  const id = newId();
  const admin = supabaseAdmin();
  const { error } = await admin.from("spaces").insert({
    id,
    input_text: input,
    title: result.title,
    language: result.language,
    vibe: result.vibe,
    modules: result.modules,
    anon_owner_token: anonToken,
    visibility: null, // draft
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, anonOwnerToken: anonToken });
}
