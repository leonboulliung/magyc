import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { ensureProfile } from "@/lib/server/profile";
import { classifyInput, type ClassifyAnswer } from "@/lib/server/classify";
import { recordAiEvent } from "@/lib/server/aiEvents";
import { insertSpaceRow } from "@/lib/server/spacePersistence";
import type { Module } from "@/lib/types";
import { sanitizeModules } from "@/lib/modules";
import { newId, newAnonToken } from "@/lib/id";
import { parseBody } from "@/lib/api/validate";
import { cleanSettings } from "@/lib/studioProfile";
import { takePersistentRateLimit } from "@/lib/server/uploadSecurity";
import { fetchOwnedPreset, materializePresetState } from "@/lib/server/presetMaterialization";
import { mergeSeededModules, workflowRules } from "@/lib/createPipeline";
import { getDictionary } from "@/lib/i18n";
import { normalizeLocale } from "@/lib/i18n/locale";
import type { Dictionary } from "@/lib/i18n";

// The classifier makes two gpt-4o-mini calls + geocoding — give headroom.
export const maxDuration = 60;

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
  t: Dictionary,
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
  if (f.client) fieldLines.push(`${t.apiCopy.clientBrand}: ${f.client}.`);
  if (f.product) fieldLines.push(`${t.apiCopy.product}: ${f.product}.`);
  if (f.goal) fieldLines.push(`${t.apiCopy.goalUsage}: ${f.goal}.`);
  if (f.usage) fieldLines.push(`${t.apiCopy.usageRights}: ${f.usage}.`);
  if (f.deadline) fieldLines.push(`${t.apiCopy.deadline}: ${f.deadline}.`);
  if (f.references) fieldLines.push(`${t.apiCopy.references}: ${f.references}.`);
  if (f.scope) fieldLines.push(`${t.apiCopy.scopeBudget}: ${f.scope}.`);

  // Prompt-first (matches the demo). A prompt and structured fields can
  // combine; with neither, fall back to a generic product-shoot seed so an
  // empty "just create one" still yields a starter brief.
  const parts: string[] = [];
  if (prompt) parts.push(prompt);
  if (fieldLines.length) parts.push((prompt ? t.apiCopy.detailsPrefix : t.apiCopy.productBriefing) + fieldLines.join(" "));
  const input = parts.join(" ").trim();
  return (input || t.apiCopy.fallbackProductShoot).slice(0, 1200);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, z.object({
    segment: z.string().optional(),
    prompt: z.string().optional(),
    projectMode: z.string().optional().nullable(),
    answers: z.unknown().optional(),
    configuredModules: z.unknown().optional(),
    presetName: z.string().optional(),
    presetId: z.string().optional(),
    presetModules: z.unknown().optional(),
    presetPromptInjections: z.unknown().optional(),
    presetAllowContextModules: z.boolean().optional(),
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
  const requestedPresetId = str(b.presetId).slice(0, 80);
  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
  let ownedPreset = null;
  try {
    ownedPreset = await fetchOwnedPreset(admin, userId, requestedPresetId);
  } catch (error) {
    console.error("[projects] preset fetch failed:", (error as Error).message);
    return NextResponse.json({ error: "presets_failed" }, { status: 500 });
  }
  const presetName = ownedPreset?.name ?? str(b.presetName);
  const presetModules = ownedPreset?.modules ?? sanitizeModules(Array.isArray(b.presetModules) ? b.presetModules.slice(0, 24) : []);
  const clarifyModules = sanitizeModules(Array.isArray(b.configuredModules) ? b.configuredModules.slice(0, 6) : []);
  const presetAllowContextModules = ownedPreset
    ? ownedPreset.allowContextModules !== false
    : b.presetAllowContextModules !== false;
  const presetPromptInjections = ownedPreset?.promptInjections ?? (Array.isArray(b.presetPromptInjections)
    ? b.presetPromptInjections.map(promptRule).filter(Boolean).slice(0, 6)
    : []);
  const projectMode = str(b.projectMode) || "photo_shoot";
  const answersRaw = Array.isArray(b.answers) ? b.answers : [];
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
    if (questionId && questionText && choice) answers.push({ questionId, questionText, choice });
    if (answers.length >= 6) break;
  }
  const seededModules: Module[] = mergeSeededModules(presetModules, clarifyModules);
  const aiAllowed = await takePersistentRateLimit(admin, `ai-project:${userId}`, 60 * 60, 60);
  if (!aiAllowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  await ensureProfile(userId);

  // Account-level Studio settings shape every new project: the working-style
  // rules are woven into the brief, and the default share state is applied so
  // the photographer's preferences don't have to be re-prompted each time.
  let studioRules: string[] = [];
  let defaultShared = false;
  let defaultLanguage = "de";
  try {
    const { data: prof } = await admin.from("profiles").select("settings").eq("id", userId).maybeSingle();
    const s = cleanSettings(prof?.settings ?? {});
    studioRules = s.rules;
    defaultShared = s.defaultShared;
    defaultLanguage = s.defaultLanguage;
  } catch {
    // Settings are an enhancement; creation must still work without them.
  }

  // Create works with a prompt, with structured fields, or with NOTHING
  // (an empty "just give me a starter project" path).
  const t = getDictionary(normalizeLocale(defaultLanguage));
  const inputBase = buildBriefInput(str(b.prompt), t, fields);
  const input = inputBase;
  const rules = workflowRules(
    presetName ? [t.apiCopy.selectedWorkflow.replace("{name}", presetName)] : [],
    presetPromptInjections,
    studioRules,
  );

  let result;
  const aiStarted = Date.now();
  try {
    result = await classifyInput(input, answers, seededModules, { projectMode, language: defaultLanguage, workflowRules: rules });
  } catch (e) {
    const err = e as { message?: string; status?: number };
    const msg = err.message || "unknown";
    console.error("[projects] classify failed:", err.status, msg);
    if (msg === "ai_not_configured")
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    if (msg === "input_not_photography_project")
      return NextResponse.json({ error: msg }, { status: 422 });
    return NextResponse.json({ error: "classify_failed", detail: msg.slice(0, 120) }, { status: 502 });
  }

  if (seededModules.length > 0 && !presetAllowContextModules) {
    const headerModules = result.modules.filter((module) => (
      module.type === "heading" || module.type === "rich_text" || module.type === "tags"
    ));
    result.modules = [
      ...headerModules,
      ...seededModules,
    ];
  }

  const id = newId();
  const { error } = await insertSpaceRow(admin, {
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
    shared: defaultShared,
  });
  if (error) {
    console.error("[projects] insert failed:", error.message);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  let presetStateCount = 0;
  if (ownedPreset?.templateState.length) {
    try {
      presetStateCount = await materializePresetState({
        admin,
        preset: ownedPreset,
        projectId: id,
        projectModules: result.modules,
        ownerId: userId,
      });
    } catch (stateError) {
      console.error("[projects] preset state materialization failed:", (stateError as Error).message);
      await admin.from("spaces").delete().eq("id", id).eq("owner_id", userId);
      return NextResponse.json({ error: "preset_materialization_failed" }, { status: 500 });
    }
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
      presetId: ownedPreset?.id ?? null,
      answers,
      presetModuleTypes: presetModules.map((m) => m.type),
      clarifyModuleTypes: clarifyModules.map((m) => m.type),
      presetPromptInjections,
      presetAllowContextModules,
      presetStateCount,
    },
    output: { title: result.title, moduleTypes: result.modules.map((m) => m.type) },
    metadata: {
      source: "studio_builder",
      segment,
      presetApplied: presetModules.length > 0,
      projectMode,
      clarifyApplied: answers.length > 0 || clarifyModules.length > 0,
      presetAllowContextModules,
      moduleCount: result.modules.length,
    },
    latencyMs: Date.now() - aiStarted,
  });

  return NextResponse.json({ ok: true, id });
}
