import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureProfile } from "@/lib/server/profile";
import { recordAiEvent } from "@/lib/server/aiEvents";
import { cleanSettings } from "@/lib/studioProfile";
import { draftContract } from "@/lib/server/contractDraft";
import type { Module } from "@/lib/types";

// The drafter makes one gpt-4o-mini call — give headroom.
export const maxDuration = 30;

/**
 * POST /api/projects/[id]/contract/draft — owner-only. Assembles a reviewable
 * contract draft from the project's modules + the photographer's saved
 * conditions/business + parties. Does NOT persist; the owner reviews/edits the
 * returned draft, and sign-off (later) freezes it into project_contracts.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id, modules, language")
    .eq("id", params.id)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (space.owner_id !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await ensureProfile(userId);
  const { data: prof } = await admin
    .from("profiles")
    .select("display_name, settings")
    .eq("id", userId)
    .maybeSingle();
  const settings = cleanSettings(prof?.settings ?? {});

  // Photographer identity: studio name from the profile, contact + email from Clerk.
  let contactName = prof?.display_name ?? "";
  let email = "";
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    contactName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || contactName;
    email = user.emailAddresses?.[0]?.emailAddress ?? "";
  } catch {
    // best-effort — the draft still works without Clerk details
  }

  const parties = {
    photographer: {
      name: contactName,
      studio: prof?.display_name ?? "",
      email,
      address: settings.business.address,
      vatId: settings.business.vatId,
      kleinunternehmer19: settings.conditions.payment.kleinunternehmer19,
    },
    client: { name: "", email: "", address: "", company: "" },
  };

  const modules = (Array.isArray(space.modules) ? space.modules : []) as Module[];
  const language = (space.language || "de").split("-")[0];

  const started = Date.now();
  let draft;
  try {
    draft = await draftContract({
      modules,
      conditions: settings.conditions,
      business: settings.business,
      parties,
      language,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "draft_failed";
    console.error("[contract-draft] failed:", msg);
    return NextResponse.json({ error: "draft_failed", detail: msg.slice(0, 120) }, { status: 502 });
  }

  await recordAiEvent({
    userId,
    spaceId: params.id,
    eventType: "contract_draft",
    model: draft.model,
    input: { moduleTypes: modules.map((m) => m.type), language },
    output: { sectionCount: draft.sections.length, gapCount: draft.gaps.length },
    metadata: { source: "contract_draft" },
    latencyMs: Date.now() - started,
  });

  return NextResponse.json({ draft });
}
