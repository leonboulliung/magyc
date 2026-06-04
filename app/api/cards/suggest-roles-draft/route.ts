import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isBanned } from "@/lib/server/safety";
import { suggestRolesFromContext } from "@/lib/server/roleSuggest";

const lastCallAt = new Map<string, number>();
const RATE_WINDOW_MS = 30_000;

/**
 * Draft variant: take Title + Description + Tags inline in the body —
 * the card doesn't exist yet — and return 0-6 suggested role labels.
 * Used by the create-form's RolesEditor's "✨ AI VORSCHLAG" button.
 *
 * Auth + ban check + 1/30s/user rate limit, same as the module-draft
 * suggest route.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isBanned(userId))
    return NextResponse.json({ error: "banned" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    tags?: string[];
  };

  const title = String(body.title || "").trim();
  if (title.length < 3) {
    return NextResponse.json({ error: "title_too_short" }, { status: 400 });
  }
  const description = String(body.description || "").trim();
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string").slice(0, 8)
    : [];

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
    const roles = await suggestRolesFromContext({ title, description, tags });
    return NextResponse.json({ ok: true, roles });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    if (msg === "ai_not_configured")
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    if (msg === "suggest_unparseable")
      return NextResponse.json({ error: "suggest_unparseable" }, { status: 500 });
    return NextResponse.json({ error: "suggest_failed", detail: msg }, { status: 502 });
  }
}
