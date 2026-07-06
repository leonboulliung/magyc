import { createHash } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProjectFacts } from "@/lib/projectFacts";
import { cleanSettings } from "@/lib/studioProfile";
import type { ActorKind, Module, ModuleStateEntry, ModuleStateKind } from "@/lib/types";
import { recordAiEvent } from "@/lib/server/aiEvents";
import { draftContract } from "@/lib/server/contractDraft";
import { ensureProfile } from "@/lib/server/profile";
import { takePersistentRateLimit } from "@/lib/server/uploadSecurity";

type StateRow = {
  id: string;
  space_id: string;
  module_index: number;
  module_id: string | null;
  actor_kind: ActorKind;
  actor_id: string;
  display_name: string | null;
  kind: ModuleStateKind;
  data: Record<string, unknown> | null;
  created_at: string;
};

function mapState(row: StateRow): ModuleStateEntry {
  return {
    id: row.id,
    spaceId: row.space_id,
    moduleIndex: row.module_index,
    moduleId: row.module_id ?? null,
    actor: {
      kind: row.actor_kind === "anon" ? "anon" : "user",
      id: row.actor_id,
      displayName: row.display_name || undefined,
    },
    kind: row.kind,
    data: row.data ?? {},
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function contractContentHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function ensureProjectContractDraft({
  admin,
  spaceId,
  force = false,
}: {
  admin: SupabaseClient;
  spaceId: string;
  force?: boolean;
}) {
  const { data: space } = await admin
    .from("spaces")
    .select("id, owner_id, modules, language")
    .eq("id", spaceId)
    .maybeSingle();
  if (!space) throw new Error("not_found");
  if (!space.owner_id) throw new Error("owner_required");

  const { data: existing } = await admin
    .from("project_contracts")
    .select("status, locked")
    .eq("space_id", spaceId)
    .maybeSingle();
  if (existing?.locked || existing?.status === "released" || existing?.status === "owner_signed" || existing?.status === "client_signed") {
    throw new Error("contract_already_released");
  }
  if (existing && !force) return { created: false as const, draft: null };

  const ownerId = String(space.owner_id);
  const allowed = await takePersistentRateLimit(admin, `ai-contract:${ownerId}`, 60 * 60, 30);
  if (!allowed) throw new Error("rate_limited");
  await ensureProfile(ownerId);
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, settings")
    .eq("id", ownerId)
    .maybeSingle();
  const settings = cleanSettings(profile?.settings ?? {});

  let contactName = profile?.display_name ?? "";
  let email = "";
  try {
    const clerk = await clerkClient();
    const owner = await clerk.users.getUser(ownerId);
    contactName = [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.username || contactName;
    email = owner.emailAddresses.find((item) => item.id === owner.primaryEmailAddressId)?.emailAddress
      || owner.emailAddresses[0]?.emailAddress
      || "";
  } catch {
    // The draft remains usable with the profile identity only.
  }

  const parties = {
    photographer: {
      name: contactName,
      studio: profile?.display_name ?? "",
      email,
      address: settings.business.address,
      vatId: settings.business.vatId,
      kleinunternehmer19: settings.conditions.payment.kleinunternehmer19,
    },
    client: { name: "", email: "", address: "", company: "" },
  };
  const modules = (Array.isArray(space.modules) ? space.modules : []) as Module[];
  const language = (space.language || "de").split("-")[0];
  const { data: stateRows } = await admin
    .from("module_state")
    .select("id, space_id, module_index, module_id, actor_kind, actor_id, display_name, kind, data, created_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: true });
  // buildProjectFacts associates state by positional index; normalise each
  // entry's index to its module's CURRENT position via the stable id so a
  // prior reorder can't misattribute collaborative content in the contract.
  const idToIndex = new Map<string, number>();
  modules.forEach((m, i) => { const id = (m as { id?: unknown }).id; if (typeof id === "string") idToIndex.set(id, i); });
  const state = ((stateRows || []) as StateRow[]).map(mapState).map((entry) => {
    const idx = entry.moduleId ? idToIndex.get(entry.moduleId) : undefined;
    return idx === undefined || idx === entry.moduleIndex ? entry : { ...entry, moduleIndex: idx };
  });
  const facts = buildProjectFacts(modules, state);

  const started = Date.now();
  const draft = await draftContract({
    modules,
    facts,
    conditions: settings.conditions,
    business: settings.business,
    parties,
    language,
  });
  const now = new Date().toISOString();
  const { error: saveError } = await admin.from("project_contracts").upsert({
    space_id: spaceId,
    parties: draft.parties,
    clauses: draft.sections,
    conditions_snapshot: settings.conditions,
    draft_meta: { model: draft.model, generatedAt: draft.generatedAt, gaps: draft.gaps },
    mode: "click",
    status: "draft",
    content_hash: contractContentHash({ parties: draft.parties, clauses: draft.sections }),
    signers: [],
    owner_signed_at: null,
    client_signed_at: null,
    signed_at: null,
    locked: false,
    audit: [{ event: existing ? "draft_regenerated" : "draft_generated", ts: now }],
    updated_at: now,
  }, { onConflict: "space_id" });
  if (saveError) throw new Error(`contract_save_failed:${saveError.message}`);

  await recordAiEvent({
    userId: ownerId,
    spaceId,
    eventType: "contract_draft",
    model: draft.model,
    input: {
      moduleTypes: modules.map((module) => module.type),
      language,
      factCounts: {
        stateRows: state.length,
        deliverables: facts.deliverables.length,
        shots: facts.shots.length,
        uploads: facts.uploads.length,
        approvals: facts.approvals.length,
      },
    },
    output: { sectionCount: draft.sections.length, gapCount: draft.gaps.length },
    metadata: { source: "contract_draft" },
    latencyMs: Date.now() - started,
  });

  return { created: true as const, draft };
}
