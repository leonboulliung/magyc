import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isBanned } from "@/lib/server/safety";
import { suggestModulesFromContext } from "@/lib/server/moduleSuggest";

const lastCallAt = new Map<string, number>();
const RATE_WINDOW_MS = 30_000;

/**
 * Per-card variant: load context from the existing card row, then ask
 * the model for at most one fitting module. Owner-only, things-only,
 * rate-limited (1 / 30s / user). The draft variant lives at
 * /api/cards/suggest-modules-draft and skips the load step.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isBanned(userId))
    return NextResponse.json({ error: "banned" }, { status: 403 });

  const admin = supabaseAdmin();
  const { data: card } = await admin
    .from("cards")
    .select("id, owner_id, title, description, tags")
    .eq("id", params.id)
    .maybeSingle();

  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (card.owner_id !== userId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

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

  try {
    const modules = await suggestModulesFromContext({
      title: String(card.title || ""),
      description: String(card.description || ""),
      tags: Array.isArray(card.tags) ? (card.tags as string[]) : [],
    });
    return NextResponse.json({ ok: true, modules });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    if (msg === "ai_not_configured")
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    if (msg === "suggest_unparseable")
      return NextResponse.json({ error: "suggest_unparseable" }, { status: 500 });
    return NextResponse.json({ error: "suggest_failed", detail: msg }, { status: 502 });
  }
}
