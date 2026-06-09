import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { classifyInput, type ClassifyAnswer } from "@/lib/server/classify";
import { resolveExternalRefs } from "@/lib/server/wikipedia";
import { newAnonToken, newId } from "@/lib/id";

const lastCallAt = new Map<string, number>();
const RATE_WINDOW_MS = 30_000;
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

  // Hydrate external references — Wikipedia widgets get their URL,
  // extract, and thumbnail filled from the MediaWiki API. Failures
  // are silent; the renderer copes with missing data.
  const hydratedModules = await resolveExternalRefs(result.modules, result.language);

  const id = newId();
  const admin = supabaseAdmin();
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
