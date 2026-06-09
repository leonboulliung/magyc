import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { regenerateWidget } from "@/lib/server/regenerate";
import { ALL_VIBES, type Module, type SpaceLabels, type Vibe } from "@/lib/types";
import { sanitizeModule } from "@/lib/modules";

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
  { params }: { params: { id: string; index: string } },
) {
  const widgetIndex = Number.parseInt(params.index, 10);
  if (!Number.isFinite(widgetIndex) || widgetIndex < 0 || widgetIndex > 64) {
    return NextResponse.json({ error: "bad_widget_index" }, { status: 400 });
  }

  let body: { count?: unknown; basePrompt?: unknown; anonToken?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

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
  const { data: space, error } = await admin
    .from("spaces")
    .select("id, input_text, language, vibe, modules, labels")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });

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
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
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
