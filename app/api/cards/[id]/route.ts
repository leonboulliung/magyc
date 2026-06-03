import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ALLOWED_MODULE_TYPES, type CardModule } from "@/lib/types";

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

  if (!Object.keys(patch).length) return NextResponse.json({ ok: true });

  const { error } = await guard.admin.from("cards").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

// Modules: typed sub-surfaces (brief, roadmap, checklist, bring, kv).
// Each type is only accepted once it has been shipped — ALLOWED_MODULE_TYPES
// is the live whitelist, grown one type at a time as modules are approved.
// Anything else is silently dropped so partial rollouts can't poison the
// jsonb column.
const ALLOWED_SET: Set<string> = new Set(ALLOWED_MODULE_TYPES);

function sanitizeModules(raw: unknown[]): CardModule[] {
  const out: CardModule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.type !== "string" || !ALLOWED_SET.has(rec.type)) continue;

    switch (rec.type) {
      case "brief": {
        if (typeof rec.text === "string") {
          const t = rec.text.trim().slice(0, 240);
          if (t) out.push({ type: "brief", text: t });
        }
        break;
      }
      case "roadmap": {
        if (Array.isArray(rec.steps)) {
          const steps: string[] = [];
          for (const s of rec.steps) {
            if (typeof s !== "string") continue;
            const v = s.trim().replace(/\s+/g, " ").slice(0, 160);
            if (v) steps.push(v);
            if (steps.length >= 8) break;
          }
          if (steps.length > 0) out.push({ type: "roadmap", steps });
        }
        break;
      }
      case "checklist": {
        if (Array.isArray(rec.items)) {
          const items: string[] = [];
          for (const s of rec.items) {
            if (typeof s !== "string") continue;
            const v = s.trim().slice(0, 160);
            if (v) items.push(v);
            if (items.length >= 12) break;
          }
          if (items.length > 0) out.push({ type: "checklist", items });
        }
        break;
      }
      case "bring": {
        if (Array.isArray(rec.items)) {
          const items: string[] = [];
          for (const s of rec.items) {
            if (typeof s !== "string") continue;
            const v = s.trim().slice(0, 80);
            if (v) items.push(v);
            if (items.length >= 16) break;
          }
          if (items.length > 0) out.push({ type: "bring", items });
        }
        break;
      }
      case "kv": {
        if (Array.isArray(rec.entries)) {
          const entries: { key: string; value: string }[] = [];
          for (const e of rec.entries) {
            if (!e || typeof e !== "object") continue;
            const er = e as Record<string, unknown>;
            if (typeof er.key !== "string" || typeof er.value !== "string") continue;
            const k = er.key.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 12);
            const v = er.value.trim().slice(0, 200);
            if (k && v) entries.push({ key: k, value: v });
            if (entries.length >= 6) break;
          }
          if (entries.length > 0) out.push({ type: "kv", entries });
        }
        break;
      }
    }
    if (out.length >= 1) break; // a thing carries at most ONE module
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
