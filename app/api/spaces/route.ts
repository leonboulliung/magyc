import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { apiServerError } from "@/lib/api/serverError";
import { classifyInput, type ClassifyAnswer } from "@/lib/server/classify";
import { sanitizeModules } from "@/lib/modules";
import type { Module } from "@/lib/types";
import { newAnonToken, newId } from "@/lib/id";
import { recordAiEvent } from "@/lib/server/aiEvents";
import { insertSpaceRow } from "@/lib/server/spacePersistence";
import { parseBody } from "@/lib/api/validate";
import { takePersistentRateLimit } from "@/lib/server/uploadSecurity";
import { cleanSettings } from "@/lib/studioProfile";
import { mergeSeededModules, workflowRules } from "@/lib/createPipeline";

// The v5 classifier makes two sequential gpt-4o-mini calls (analyze +
// author) plus a Wikipedia hydration pass. Give the function headroom
// beyond the 10s default so it never times out mid-compose.
export const maxDuration = 30;

const lastCallAt = new Map<string, number>();
// 8 s window — enough to prevent double-submit spam but allows
// quick retries during testing / development.
const RATE_WINDOW_MS = 8_000;
const MAX_INPUT_CHARS = 4000;
const MAX_ANSWERS = 6;
const FIELD_MAX = 600;
const str = (v: unknown) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, FIELD_MAX) : "";
const promptRule = (v: unknown) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 500) : "";

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
  const { userId } = await auth();
  const parsed = await parseBody(req, z.object({
    input: z.string().optional(),
    projectMode: z.string().optional().nullable(),
    language: z.string().max(8).optional(),
    answers: z.unknown().optional(),
    configuredModules: z.unknown().optional(),
    presetName: z.string().optional(),
    presetModules: z.unknown().optional(),
    presetPromptInjections: z.unknown().optional(),
    presetAllowContextModules: z.boolean().optional(),
    anonToken: z.string().optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

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

  // Pre-configured modules from the clarify step (location pin, phases,
  // …). Sanitised into real Modules; anything malformed is dropped.
  const configuredRaw = Array.isArray(body.configuredModules) ? body.configuredModules : [];
  const configuredModules = sanitizeModules(configuredRaw.slice(0, 6));
  const presetName = str(body.presetName);
  const presetModules = sanitizeModules(Array.isArray(body.presetModules) ? body.presetModules.slice(0, 24) : []);
  const presetAllowContextModules = body.presetAllowContextModules !== false;
  const presetPromptInjections = Array.isArray(body.presetPromptInjections)
    ? body.presetPromptInjections.map(promptRule).filter(Boolean).slice(0, 6)
    : [];
  const seededModules: Module[] = mergeSeededModules(presetModules, configuredModules);
  const rules = workflowRules(
    presetName ? [`Gewählter Workflow: ${presetName}.`] : [],
    presetPromptInjections,
  );

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

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    const msg = (e as Error).message || "supabase_unavailable";
    return NextResponse.json({ error: "db_unavailable", detail: msg }, { status: 503 });
  }
  const aiAllowed = await takePersistentRateLimit(admin, `ai-create:${userId || anonToken}`, 60 * 60, 40);
  if (!aiAllowed) {
    return NextResponse.json({ error: "rate_limited", retryInSeconds: 60 }, { status: 429 });
  }

  // Anonymous marketing starts use the public German default. Once a Clerk
  // account is present, its Studio setting is authoritative on every entry
  // path, including a project started from the marketing homepage.
  let language = body.language || "de";
  if (userId) {
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("settings")
        .eq("id", userId)
        .maybeSingle();
      language = cleanSettings(profile?.settings ?? {}).defaultLanguage;
    } catch {
      // Keep the safe public default if profile storage is temporarily absent.
    }
  }

  let result;
  const aiStarted = Date.now();
  try {
    result = await classifyInput(input, answers, seededModules, {
      projectMode: body.projectMode,
      language,
      workflowRules: rules,
    });
  } catch (e) {
    const err = e as { message?: string; status?: number; code?: string };
    const msg = err.message || "unknown";
    await recordAiEvent({
      userId,
      anonId: anonToken,
      eventType: "classify",
      model: "gpt-4o-mini",
      status: "error",
      input: {
        input,
        answers,
        configuredModuleTypes: configuredModules.map((m) => m.type),
        presetName: presetName || null,
        presetModuleTypes: presetModules.map((m) => m.type),
        presetPromptInjections,
        presetAllowContextModules,
      },
      error: msg,
      metadata: { projectMode: body.projectMode ?? null, status: err.status ?? null, code: err.code ?? null },
      latencyMs: Date.now() - aiStarted,
    });
    // Log the full error server-side so it appears in Vercel logs.
    console.error("[spaces] classify failed:", err.status, err.code, msg);
    if (msg === "ai_not_configured")
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    if (msg === "classify_unparseable")
      return NextResponse.json({ error: "classify_unparseable" }, { status: 500 });
    if (msg === "input_not_photography_project")
      return NextResponse.json({ error: msg }, { status: 422 });
    // Surface a short, actionable detail to the client.
    const detail = err.status === 429
      ? "openai_rate_limited"
      : err.status === 401
        ? "openai_auth"
        : err.code === "insufficient_quota"
          ? "openai_quota"
          : msg.slice(0, 120);
    return NextResponse.json({ error: "classify_failed", detail }, { status: 502 });
  }

  // Wikipedia hydration is NOT done here — it would add ~2.5s to the
  // creation request, pushing the two-stage classifier + geocoding past
  // the serverless timeout. Instead the space is stored with topic-only
  // Wikipedia widgets and SpaceView resolves them lazily on first load
  // (POST /api/spaces/[id]/resolve). Geocoding already ran inside the
  // author stage (coords are required before sanitisation).
  if (seededModules.length > 0 && !presetAllowContextModules) {
    const headerModules = result.modules.filter((module) => (
      module.type === "heading" || module.type === "rich_text" || module.type === "tags"
    ));
    result.modules = [
      ...headerModules,
      ...seededModules,
    ];
  }
  const hydratedModules: unknown[] = result.modules;

  const id = newId();
  const { error } = await insertSpaceRow(admin, {
    id,
    input_text: input,
    title: result.title,
    language: result.language,
    vibe: result.vibe,
    modules: hydratedModules,
    labels: result.labels,
    style: result.style,
    anon_owner_token: anonToken,
    visibility: null,
  });
  if (error) {
    return apiServerError("create_failed", "spaces/create", error);
  }

  await recordAiEvent({
    userId,
    anonId: anonToken,
    spaceId: id,
    eventType: "classify",
    model: "gpt-4o-mini",
    input: {
      input,
      answers,
      configuredModuleTypes: configuredModules.map((m) => m.type),
      presetName: presetName || null,
      presetModuleTypes: presetModules.map((m) => m.type),
      presetPromptInjections,
      presetAllowContextModules,
    },
    output: {
      title: result.title,
      language: result.language,
      vibe: result.vibe,
      moduleTypes: result.modules.map((m) => m.type),
    },
    metadata: {
      projectMode: body.projectMode ?? null,
      presetApplied: presetModules.length > 0,
      presetAllowContextModules,
      moduleCount: result.modules.length,
    },
    latencyMs: Date.now() - aiStarted,
  });

  return NextResponse.json({ ok: true, id, anonOwnerToken: anonToken });
}
