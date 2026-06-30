import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { apiServerError } from "@/lib/api/serverError";
import { regenerateWidget } from "@/lib/server/regenerate";
import { resolveExternalRefs } from "@/lib/server/wikipedia";
import { ALL_VIBES, type Module, type SpaceLabels, type Vibe } from "@/lib/types";
import { sanitizeModule } from "@/lib/modules";
import { recordAiEvent } from "@/lib/server/aiEvents";
import { parseBody } from "@/lib/api/validate";
import { takePersistentRateLimit } from "@/lib/server/uploadSecurity";
import { canEditProject, getProjectAccess } from "@/lib/server/projectAccess";

const lastCallAt = new Map<string, number>();
const RATE_WINDOW_MS = 8_000;

/**
 * POST /api/spaces/[id]/widgets/[index]/regenerate
 *
 *   Body: { count?: number, basePrompt?: string, anonToken?: string }
 *
 * Returns N alternative configurations for the widget at the given
 * index — used by the per-widget "Wechsel"-button UX. The endpoint
 * does NOT persist anything; saving an alternative goes through the
 * separate PUT widget endpoint.
 *
 * Rate-limited per anon token to keep the cost reasonable even when
 * a user cycles through alternatives quickly.
 */
export async function POST(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string; index: string }> },
) {
  const params = await paramsPromise;
  const { userId } = await auth();
  const widgetIndex = Number.parseInt(params.index, 10);
  if (!Number.isFinite(widgetIndex) || widgetIndex < 0 || widgetIndex > 64) {
    return NextResponse.json({ error: "bad_widget_index" }, { status: 400 });
  }

  const parsed = await parseBody(req, z.object({
    count: z.number().optional(),
    basePrompt: z.string().optional(),
    anonToken: z.string().optional(),
  }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const anonToken = typeof body.anonToken === "string" ? body.anonToken.slice(0, 64) : "";
  const rateKey = anonToken || `regen:${params.id}:${widgetIndex}`;
  const now = Date.now();
  const last = lastCallAt.get(rateKey) || 0;
  if (now - last < RATE_WINDOW_MS) {
    const retryIn = Math.ceil((RATE_WINDOW_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: "rate_limited", retryInSeconds: retryIn },
      { status: 429 },
    );
  }
  lastCallAt.set(rateKey, now);

  // Load the space + the widget.
  const admin = supabaseAdmin();
  const persistentAllowed = await takePersistentRateLimit(admin, `ai-regenerate:${userId || rateKey}`, 60 * 60, 120);
  if (!persistentAllowed) return NextResponse.json({ error: "rate_limited", retryInSeconds: 60 }, { status: 429 });

  const { data: space, error } = await admin
    .from("spaces")
    .select("id, input_text, language, vibe, modules, labels, stage, shared, owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return apiServerError("regenerate_failed", "widget-regenerate/read", error);
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (space.stage) {
    const accessRole = await getProjectAccess(admin, {
      spaceId: params.id,
      ownerId: space.owner_id,
      shared: space.shared,
      userId,
    });
    if (!canEditProject(accessRole)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const modules = Array.isArray(space.modules) ? space.modules : [];
  if (widgetIndex >= modules.length) {
    return NextResponse.json({ error: "widget_out_of_range" }, { status: 400 });
  }
  const current = sanitizeModule(modules[widgetIndex]);
  if (!current) {
    return NextResponse.json({ error: "widget_unsanitisable" }, { status: 400 });
  }

  // Parameters.
  const count = typeof body.count === "number" && Number.isFinite(body.count)
    ? Math.max(1, Math.min(12, Math.floor(body.count)))
    : undefined;
  const basePrompt = typeof body.basePrompt === "string"
    ? body.basePrompt.trim().slice(0, 400)
    : undefined;

  const vibeRaw = (space.vibe ?? "minimal") as string;
  const vibe: Vibe = (ALL_VIBES as readonly string[]).includes(vibeRaw)
    ? (vibeRaw as Vibe) : "minimal";

  const started = Date.now();
  try {
    const result = await regenerateWidget({
      spaceInput: String(space.input_text ?? ""),
      language: String(space.language ?? "en"),
      vibe,
      labels: (space.labels ?? {}) as SpaceLabels,
      current: current as Module,
      count,
      basePrompt,
    });
    // Hydrate Wikipedia suggestions before the client sees them — so
    // the preview cards in the popover already show the resolved
    // article title + extract instead of just the AI's guess.
    const suggestions = await resolveExternalRefs(
      result.suggestions,
      String(space.language ?? "en"),
    ) as Module[];
    await recordAiEvent({
      userId,
      anonId: anonToken || null,
      spaceId: params.id,
      moduleIndex: widgetIndex,
      eventType: basePrompt ? "widget_prompt_edit" : "widget_regenerate",
      model: "gpt-4o-mini",
      input: { widgetType: current.type, basePrompt: basePrompt ?? null, count },
      output: { suggestionTypes: suggestions.map((m) => m.type), suggestions },
      metadata: { language: String(space.language ?? "en"), vibe, hydrated: true },
      latencyMs: Date.now() - started,
    });
    return NextResponse.json({ ok: true, suggestions });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    await recordAiEvent({
      userId,
      anonId: anonToken || null,
      spaceId: params.id,
      moduleIndex: widgetIndex,
      eventType: basePrompt ? "widget_prompt_edit" : "widget_regenerate",
      model: "gpt-4o-mini",
      status: "error",
      input: { widgetType: current.type, basePrompt: basePrompt ?? null, count },
      error: msg,
      metadata: { language: String(space.language ?? "en"), vibe },
      latencyMs: Date.now() - started,
    });
    if (msg === "ai_not_configured")
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    if (msg === "regen_not_supported")
      return NextResponse.json({ error: "regen_not_supported" }, { status: 400 });
    if (msg === "regen_unparseable")
      return NextResponse.json({ error: "regen_unparseable" }, { status: 500 });
    if (msg === "regen_empty")
      return NextResponse.json({ error: "regen_empty" }, { status: 502 });
    return NextResponse.json({ error: "regen_failed", detail: msg }, { status: 502 });
  }
}
