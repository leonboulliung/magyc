import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizeModules } from "@/lib/server/moduleSanitize";
import { rolesForStorage, sanitizeRoleLabels } from "@/lib/server/roleSanitize";
import { regenerateSignatureInBackground } from "@/lib/server/signatureCompute";
import type { CardModule } from "@/lib/types";

async function loadOwned(id: string, userId: string) {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("cards")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (data.owner_id !== userId)
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { admin };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const guard = await loadOwned(params.id, userId);
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    spots?: number;
    permission?: "public" | "request";
    customFields?: Record<string, string>;
    roadmap?: unknown[];
    modules?: unknown[];
    roles?: unknown[];
  };

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.spots === "number")
    patch.spots = Math.max(1, Math.min(99, Math.floor(body.spots)));
  if (body.permission === "public" || body.permission === "request")
    patch.permission = body.permission;
  if (body.customFields && typeof body.customFields === "object") {
    patch.custom_fields = sanitizeCustomFields(body.customFields);
  }
  if (Array.isArray(body.roadmap)) {
    patch.roadmap = sanitizeRoadmap(body.roadmap);
  }
  if (Array.isArray(body.modules)) {
    patch.modules = sanitizeModules(body.modules);
  }
  if (Array.isArray(body.roles)) {
    // Removing a label doesn't kick a joiner who claimed it — their
    // `joiners.role` row still exists but stops matching a slot.
    // (Owner can re-add the label later and reconnect them.)
    patch.roles = rolesForStorage(sanitizeRoleLabels(body.roles));
  }

  if (!Object.keys(patch).length) return NextResponse.json({ ok: true });

  const { error } = await guard.admin.from("cards").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If anything that feeds the signature changed (title / description /
  // modules), regenerate it in the background. Tags can't change via
  // this PATCH today; if that ever changes we'll add the trigger.
  const sigInputs = ["title", "description", "modules"] as const;
  if (sigInputs.some((k) => k in patch)) {
    const { data: row } = await guard.admin
      .from("cards")
      .select("title, description, tags, modules")
      .eq("id", params.id)
      .maybeSingle();
    if (row) {
      const first = Array.isArray(row.modules) ? row.modules[0] : null;
      regenerateSignatureInBackground(
        params.id,
        {
          title: String(row.title || ""),
          description: String(row.description || ""),
          tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
          module: (first ?? undefined) as CardModule | undefined,
        },
        async (cardId, sig) => {
          await guard.admin.from("cards").update({ signature: sig }).eq("id", cardId);
        },
      );
    }
  }
  return NextResponse.json({ ok: true });
}

// Custom fields: AI-suggested keys (uppercase short labels, hyphens ok),
// creator-written values. Cap key + value lengths so a misbehaving client
// can't blow up the JSONB column. Drop empty values entirely — an empty
// "BRING": "" is just visual noise on the detail page.
const KEY_RE = /^[A-Z][A-Z0-9-]{1,11}$/;
function sanitizeCustomFields(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, rawVal] of Object.entries(raw)) {
    const key = String(rawKey).trim().toUpperCase().replace(/\s+/g, "-").slice(0, 12);
    if (!KEY_RE.test(key)) continue;
    if (typeof rawVal !== "string") continue;
    const value = rawVal.trim().slice(0, 200);
    if (!value) continue;
    out[key] = value;
    if (Object.keys(out).length >= 6) break;
  }
  return out;
}

// Roadmap: an ordered list of short step labels. Cap each item, drop
// empties, hard ceiling of 8 steps so a misbehaving client can't
// blow up the JSONB column.
function sanitizeRoadmap(raw: unknown[]): string[] {
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const cleaned = v.trim().replace(/\s+/g, " ").slice(0, 160);
    if (!cleaned) continue;
    out.push(cleaned);
    if (out.length >= 8) break;
  }
  return out;
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const guard = await loadOwned(params.id, userId);
  if (guard.error) return guard.error;

  const { error } = await guard.admin.from("cards").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
