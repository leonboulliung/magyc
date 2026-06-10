import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { classifyInput, type ClassifyAnswer } from "@/lib/server/classify";
import { resolveExternalRefs } from "@/lib/server/wikipedia";
import { newAnonToken, newId } from "@/lib/id";

// The v5 classifier makes two sequential gpt-4o-mini calls (analyze +
// author) plus a Wikipedia hydration pass. Give the function headroom
// beyond the 10s default so it never times out mid-compose.
export const maxDuration = 30;

const lastCallAt = new Map<string, number>();
// 8 s window — enough to prevent double-submit spam but allows
// quick retries during testing / development.
const RATE_WINDOW_MS = 8_000;
const MAX_INPUT_CHARS = 1200;
const MAX_ANSWERS = 6;

/**
 * POST /api/spaces — second leg of the create flow.
 *
 *   Body: {
 *     input: string,
 *     answers: [{ questionId, questionText, choice }],
 *     anonToken?: string,
 *   }
 *
 * Runs the classifier with input + clarification answers, persists
 * the space, returns its id + owner token.
 */
export async function POST(req: Request) {
  let body: {
    input?: string;
    answers?: unknown;
    anonToken?: string;
  };
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

  // Shape-check the answers.
  const answersRaw = Array.isArray(body.answers) ? body.answers : [];
  const answers: ClassifyAnswer[] = [];
  for (const a of answersRaw) {
    if (!a || typeof a !== "object") continue;
    const ar = a as Record<string, unknown>;
    const questionId = typeof ar.questionId === "string" ? ar.questionId.slice(0, 16) : "";
    const questionText = typeof ar.questionText === "string"
      ? ar.questionText.trim().slice(0, 200)
      : "";
    const choice = typeof ar.choice === "string"
      ? ar.choice.trim().slice(0, 200)
      : "";
    if (questionId && questionText && choice) {
      answers.push({ questionId, questionText, choice });
    }
    if (answers.length >= MAX_ANSWERS) break;
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
    result = await classifyInput(input, answers);
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    if (msg === "ai_not_configured")
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    if (msg === "classify_unparseable")
      return NextResponse.json({ error: "classify_unparseable" }, { status: 500 });
    return NextResponse.json({ error: "classify_failed", detail: msg }, { status: 502 });
  }

  // Hydrate external references — Wikipedia widgets get URL, extract,
  // and thumbnail. Race against a 4 s hard timeout so slow Wikipedia
  // responses never block space creation. Failures are always silent.
  let hydratedModules: unknown[] = result.modules;
  try {
    const timeout = new Promise<unknown[]>((resolve) =>
      setTimeout(() => resolve(result.modules), 4_000),
    );
    hydratedModules = await Promise.race([
      resolveExternalRefs(result.modules, result.language),
      timeout,
    ]);
  } catch {
    // Wikipedia resolution failed — continue with unresolved modules.
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    const msg = (e as Error).message || "supabase_unavailable";
    return NextResponse.json({ error: "db_unavailable", detail: msg }, { status: 503 });
  }

  const id = newId();
  const { error } = await admin.from("spaces").insert({
    id,
    input_text: input,
    title: result.title,
    language: result.language,
    vibe: result.vibe,
    modules: hydratedModules,
    labels: result.labels,
    anon_owner_token: anonToken,
    visibility: null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, anonOwnerToken: anonToken });
}
