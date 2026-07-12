import { SignInButton } from "@clerk/nextjs";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";
import { CONTRACT_VERSION } from "@/lib/contract";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { AdminConsole, type AdminConsoleData, type AdminSpace, type AdminTicket, type AdminUser, type TimelineEntry } from "@/components/admin/AdminConsole";
import type { AccountStatus, AdminPlan, SupportStatus } from "@/lib/adminAccount";
import { de } from "@/lib/i18n/dictionaries/de";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  plan?: AdminPlan | null;
  account_status?: AccountStatus | null;
  admin_notes?: string | null;
  email?: string | null;
  clerk_last_active_at?: string | null;
};

type ActivityRollupRow = {
  user_id: string;
  space_count: number | string | null;
  action_count: number | string | null;
  ai_run_count: number | string | null;
  last_seen: string | null;
};

const ADMIN_PAGE_SIZE = 40;

type SpaceRow = {
  id: string;
  title: string;
  owner_id: string | null;
  stage: string | null;
  segment: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  modules: unknown[] | null;
  created_at: string;
};

type StateRow = {
  space_id: string;
  actor_kind: "user" | "anon";
  actor_id: string;
  kind: string;
  data: Record<string, unknown> | null;
  created_at: string;
};

type AiEventRow = {
  id: string;
  user_id: string | null;
  space_id: string | null;
  event_type: string;
  status: "ok" | "error";
  created_at: string;
};

type AppEventRow = {
  id: string;
  user_id: string | null;
  actor_kind: "user" | "anon" | null;
  actor_id: string | null;
  space_id: string | null;
  event_type: string;
  status: "ok" | "warn" | "error";
  created_at: string;
};

type UploadUsageRow = {
  space_id: string;
  upload_count: number | string | null;
  total_bytes: number | string | null;
};

type SupportTicketRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  type: string;
  status: SupportStatus;
  message: string;
  route: string | null;
  space_id: string | null;
  last_error: string | null;
  created_at: string;
  done_at: string | null;
};

function phaseLabel(space: SpaceRow): string {
  if (space.deleted_at) return de.admin.phaseDeleted;
  if (space.archived_at) return de.admin.phaseArchived;
  if (space.stage === "brief") return de.admin.phasePlanning;
  if (space.stage === "production") return de.admin.contractStage;
  if (space.stage === "handoff") return de.admin.phaseClosed;
  return de.admin.phaseDraft;
}

function stateSize(row: StateRow): number {
  const raw = row.data?.size;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw);
  return 0;
}

async function loadProfiles(
  admin: ReturnType<typeof supabaseAdmin>,
  options: { query: string; page: number },
) {
  const offset = (options.page - 1) * ADMIN_PAGE_SIZE;
  try {
    const client = await clerkClient();
    const [pageResult, activeResult, totalUsers] = await Promise.all([
      client.users.getUserList({
        query: options.query || undefined,
        limit: ADMIN_PAGE_SIZE,
        offset,
        orderBy: "-created_at",
      }),
      client.users.getUserList({
        last_active_at_since: Date.now() - 7 * 24 * 60 * 60 * 1000,
        limit: 1,
        offset: 0,
      }),
      client.users.getCount(),
    ]);
    const ids = pageResult.data.map((user) => user.id);
    let rows: ProfileRow[] = [];
    let warning: string | null = null;
    if (ids.length) {
      const rich = await admin
        .from("profiles")
        .select("id, display_name, avatar_url, created_at, plan, account_status, admin_notes")
        .in("id", ids);
      if (!rich.error) {
        rows = (rich.data || []) as ProfileRow[];
      } else {
        const fallback = await admin
          .from("profiles")
          .select("id, display_name, avatar_url, created_at")
          .in("id", ids);
        if (fallback.error) throw fallback.error;
        rows = (fallback.data || []) as ProfileRow[];
        warning = de.admin.migration21Defaults;
      }
    }
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const profiles: ProfileRow[] = pageResult.data.map((user) => {
      const row = rowById.get(user.id);
      const email = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress
        || user.emailAddresses[0]?.emailAddress
        || null;
      const clerkName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "";
      return {
        id: user.id,
        display_name: row?.display_name || clerkName || `user-${user.id.slice(-6)}`,
        avatar_url: row?.avatar_url || user.imageUrl || null,
        created_at: row?.created_at || new Date(user.createdAt).toISOString(),
        plan: row?.plan,
        account_status: row?.account_status,
        admin_notes: row?.admin_notes,
        email,
        clerk_last_active_at: user.lastActiveAt ? new Date(user.lastActiveAt).toISOString() : null,
      };
    });
    return {
      profiles,
      warning,
      totalCount: totalUsers,
      filteredCount: pageResult.totalCount,
      activeUsers7d: activeResult.totalCount,
    };
  } catch (error) {
    console.warn("[admin] Clerk pagination unavailable, using profile fallback:", (error as Error).message);
    let query = admin
      .from("profiles")
      .select("id, display_name, avatar_url, created_at, plan, account_status, admin_notes", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + ADMIN_PAGE_SIZE - 1);
    if (options.query) query = query.ilike("display_name", `%${options.query}%`);
    const result = await query;
    let fallbackWarning = de.admin.clerkFallback;
    let fallbackProfiles: ProfileRow[];
    let filteredCount: number;
    if (result.error) {
      let basicQuery = admin
        .from("profiles")
        .select("id, display_name, avatar_url, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + ADMIN_PAGE_SIZE - 1);
      if (options.query) basicQuery = basicQuery.ilike("display_name", `%${options.query}%`);
      const basic = await basicQuery;
      if (basic.error) throw basic.error;
      fallbackProfiles = (basic.data || []) as ProfileRow[];
      filteredCount = basic.count || 0;
      fallbackWarning = de.admin.clerkAndMigrationFallback;
    } else {
      fallbackProfiles = (result.data || []) as ProfileRow[];
      filteredCount = result.count || 0;
    }
    const totalResult = await admin.from("profiles").select("id", { count: "exact", head: true });
    return {
      profiles: fallbackProfiles,
      warning: fallbackWarning,
      totalCount: totalResult.count || filteredCount,
      filteredCount,
      activeUsers7d: 0,
    };
  }
}

async function loadOptionalTable<T>(
  promise: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  warning: string,
) {
  const res = await promise;
  if (res.error) {
    console.warn("[admin] optional data unavailable:", res.error.message);
    return { rows: [] as T[], warning };
  }
  return { rows: (res.data || []) as T[], warning: null };
}

async function loadAdminData(
  signedInAs: string,
  options: { query: string; page: number },
): Promise<AdminConsoleData> {
  const admin = supabaseAdmin();
  const migrationWarnings: string[] = [];

  const profilesRes = await loadProfiles(admin, options);
  if (profilesRes.warning) migrationWarnings.push(profilesRes.warning);
  const profiles = profilesRes.profiles;
  const userIds = profiles.map((profile) => profile.id);
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const spacesQuery = admin
    .from("spaces")
    .select("id, title, owner_id, stage, segment, archived_at, deleted_at, modules, created_at")
    .order("created_at", { ascending: false });
  const stateQuery = admin
    .from("module_state")
    .select("space_id, actor_kind, actor_id, kind, data, created_at")
    .eq("actor_kind", "user")
    .order("created_at", { ascending: false })
    .limit(1200);
  const aiQuery = admin
    .from("ai_events")
    .select("id, user_id, space_id, event_type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(600);

  const [spacesRes, stateRes, aiEventsRes, appEventsRes, uploadUsageRes, supportRes, activityRes, spacesTotalRes, spaces7dRes, aiErrorsRes, appErrorsRes] = await Promise.all([
    userIds.length ? spacesQuery.in("owner_id", userIds) : spacesQuery.eq("owner_id", "__none__"),
    userIds.length ? stateQuery.in("actor_id", userIds) : stateQuery.eq("actor_id", "__none__"),
    userIds.length ? aiQuery.in("user_id", userIds) : aiQuery.eq("user_id", "__none__"),
    admin.from("app_events").select("id, user_id, actor_kind, actor_id, space_id, event_type, status, created_at").order("created_at", { ascending: false }).limit(600),
    admin.rpc("space_upload_usage_by_space", { p_limit: 1000 }),
    loadOptionalTable<SupportTicketRow>(
      admin.from("support_tickets").select("id, user_id, email, type, status, message, route, space_id, last_error, created_at, done_at").order("created_at", { ascending: false }).limit(250),
      de.admin.supportMigrationMissing,
    ),
    admin.rpc("admin_user_activity_rollup", { p_user_ids: userIds }),
    admin.from("spaces").select("id", { count: "exact", head: true }),
    admin.from("spaces").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgoIso),
    admin.from("ai_events").select("id", { count: "exact", head: true }).eq("status", "error"),
    admin.from("app_events").select("id", { count: "exact", head: true }).eq("status", "error"),
  ]);

  if (spacesRes.error) throw spacesRes.error;
  if (stateRes.error) throw stateRes.error;

  const aiEvents = aiEventsRes.error ? [] : ((aiEventsRes.data || []) as AiEventRow[]);
  const appEvents = appEventsRes.error ? [] : ((appEventsRes.data || []) as AppEventRow[]);
  const uploadUsageRows = uploadUsageRes.error ? [] : ((uploadUsageRes.data || []) as UploadUsageRow[]);
  const supportRows = supportRes.rows;
  if (aiEventsRes.error) migrationWarnings.push(de.admin.aiEventsUnreadable);
  if (appEventsRes.error) migrationWarnings.push(de.admin.opsEventsUnreadable);
  if (uploadUsageRes.error) migrationWarnings.push(de.admin.uploadRollupUnreadable);
  if (supportRes.warning) migrationWarnings.push(supportRes.warning);

  const spaces = (spacesRes.data || []) as SpaceRow[];
  const state = (stateRes.data || []) as StateRow[];
  const activityRows = activityRes.error ? [] : ((activityRes.data || []) as ActivityRollupRow[]);
  if (activityRes.error) migrationWarnings.push(de.admin.activityMigrationMissing);

  const uploadUsageBySpace = new Map<string, { uploadCount: number; uploadBytes: number }>();
  for (const row of uploadUsageRows) {
    if (!row.space_id) continue;
    uploadUsageBySpace.set(row.space_id, {
      uploadCount: Number(row.upload_count || 0) || 0,
      uploadBytes: Number(row.total_bytes || 0) || 0,
    });
  }
  if (uploadUsageBySpace.size === 0) {
    for (const row of state.filter((entry) => entry.kind === "upload")) {
      const prev = uploadUsageBySpace.get(row.space_id) || { uploadCount: 0, uploadBytes: 0 };
      uploadUsageBySpace.set(row.space_id, {
        uploadCount: prev.uploadCount + 1,
        uploadBytes: prev.uploadBytes + stateSize(row),
      });
    }
  }

  const spacesByOwner = new Map<string, number>();
  const actionsByUser = new Map<string, number>();
  const aiByUser = new Map<string, number>();
  const lastSeenByUser = new Map<string, string>();
  const timeline: TimelineEntry[] = [];

  for (const profile of profiles) {
    if (profile.clerk_last_active_at) lastSeenByUser.set(profile.id, profile.clerk_last_active_at);
  }

  function markSeen(userId: string | null | undefined, createdAt: string) {
    if (!userId) return;
    const current = lastSeenByUser.get(userId);
    if (!current || new Date(createdAt).getTime() > new Date(current).getTime()) {
      lastSeenByUser.set(userId, createdAt);
    }
  }

  for (const space of spaces) {
    if (!space.owner_id) continue;
    spacesByOwner.set(space.owner_id, (spacesByOwner.get(space.owner_id) || 0) + 1);
    markSeen(space.owner_id, space.created_at);
    timeline.push({
      id: `space:${space.id}`,
      userId: space.owner_id,
      label: de.admin.projectCreated,
      detail: space.title || space.id,
      at: space.created_at,
      href: `/admin/spaces/${space.id}`,
    });
  }

  for (const row of state) {
    if (row.actor_kind !== "user") continue;
    actionsByUser.set(row.actor_id, (actionsByUser.get(row.actor_id) || 0) + 1);
    markSeen(row.actor_id, row.created_at);
    timeline.push({
      id: `state:${row.space_id}:${row.kind}:${row.created_at}`,
      userId: row.actor_id,
      label: `Element-Aktion: ${row.kind}`,
      detail: row.space_id,
      at: row.created_at,
      href: `/admin/spaces/${row.space_id}`,
    });
  }

  for (const event of aiEvents) {
    if (!event.user_id) continue;
    aiByUser.set(event.user_id, (aiByUser.get(event.user_id) || 0) + 1);
    markSeen(event.user_id, event.created_at);
    timeline.push({
      id: `ai:${event.id}`,
      userId: event.user_id,
      label: `KI: ${event.event_type}`,
      detail: event.status,
      at: event.created_at,
      href: event.space_id ? `/admin/spaces/${event.space_id}` : undefined,
    });
  }

  for (const event of appEvents) {
    const userId = event.user_id || (event.actor_kind === "user" ? event.actor_id : null);
    if (!userId || !userIds.includes(userId)) continue;
    markSeen(userId, event.created_at);
    timeline.push({
      id: `app:${event.id}`,
      userId,
      label: `System: ${event.event_type}`,
      detail: event.status,
      at: event.created_at,
      href: event.space_id ? `/admin/spaces/${event.space_id}` : undefined,
    });
  }

  for (const row of activityRows) {
    spacesByOwner.set(row.user_id, Number(row.space_count || 0) || 0);
    actionsByUser.set(row.user_id, Number(row.action_count || 0) || 0);
    aiByUser.set(row.user_id, Number(row.ai_run_count || 0) || 0);
    if (row.last_seen) markSeen(row.user_id, row.last_seen);
  }

  const tickets: AdminTicket[] = supportRows.map((ticket) => {
    markSeen(ticket.user_id, ticket.created_at);
    timeline.push({
      id: `support:${ticket.id}`,
      userId: ticket.user_id,
      label: "Support-Ticket",
      detail: ticket.message.slice(0, 90),
      at: ticket.created_at,
      href: ticket.space_id ? `/admin/spaces/${ticket.space_id}` : undefined,
    });
    return {
      id: ticket.id,
      userId: ticket.user_id,
      email: ticket.email,
      type: ticket.type,
      status: ticket.status,
      message: ticket.message,
      route: ticket.route,
      spaceId: ticket.space_id,
      lastError: ticket.last_error,
      createdAt: ticket.created_at,
      doneAt: ticket.done_at,
    };
  });

  const users: AdminUser[] = profiles.map((profile) => ({
    id: profile.id,
    displayName: profile.display_name || `user-${profile.id.slice(-6)}`,
    email: profile.email || null,
    avatarUrl: profile.avatar_url,
    createdAt: profile.created_at,
    plan: profile.plan || "free",
    accountStatus: profile.account_status || "active",
    adminNotes: profile.admin_notes || "",
    spaces: spacesByOwner.get(profile.id) || 0,
    actions: actionsByUser.get(profile.id) || 0,
    aiRuns: aiByUser.get(profile.id) || 0,
    lastSeen: lastSeenByUser.get(profile.id) || profile.created_at,
  }));

  const adminSpaces: AdminSpace[] = spaces.map((space) => {
    const usage = uploadUsageBySpace.get(space.id) || { uploadCount: 0, uploadBytes: 0 };
    return {
      id: space.id,
      title: space.title || space.id,
      ownerId: space.owner_id,
      phase: phaseLabel(space),
      segment: space.segment,
      moduleCount: Array.isArray(space.modules) ? space.modules.length : 0,
      uploadCount: usage.uploadCount,
      uploadBytes: usage.uploadBytes,
      createdAt: space.created_at,
      archivedAt: space.archived_at,
      deletedAt: space.deleted_at,
    };
  });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return {
    signedInAs,
    migrationWarnings,
    metrics: {
      users: profilesRes.totalCount,
      activeUsers7d: profilesRes.activeUsers7d,
      spaces: spacesTotalRes.count ?? adminSpaces.length,
      spaces7d: spaces7dRes.count ?? adminSpaces.filter((space) => new Date(space.createdAt).getTime() >= sevenDaysAgo).length,
      openTickets: tickets.filter((ticket) => ticket.status === "new").length,
      aiErrors: aiErrorsRes.count ?? aiEvents.filter((event) => event.status === "error").length,
      appErrors: appErrorsRes.count ?? appEvents.filter((event) => event.status === "error").length,
      uploadedBytes: [...uploadUsageBySpace.values()].reduce((sum, usage) => sum + usage.uploadBytes, 0),
    },
    users,
    spaces: adminSpaces,
    tickets,
    timeline: timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 1200),
    pagination: {
      query: options.query,
      page: options.page,
      pageSize: ADMIN_PAGE_SIZE,
      total: profilesRes.filteredCount,
    },
  };
}

function GateMessage({ reason }: { reason: NonNullable<Awaited<ReturnType<typeof requireAdmin>>["reason"]> }) {
  if (reason === "signed_out") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f1] px-6 text-[#17171a]">
        <div className="max-w-sm space-y-4">
          <p className="mono text-[11px] uppercase tracking-[0.28em] opacity-50">MAGYC Admin</p>
          <h1 className="text-2xl font-semibold">Anmeldung erforderlich</h1>
          <SignInButton mode="modal">
            <button className="rounded-full border border-black/20 px-5 py-3 text-sm">
              Einloggen
            </button>
          </SignInButton>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f4f1] px-6 text-[#17171a]">
      <div className="max-w-lg space-y-3">
        <p className="mono text-[11px] uppercase tracking-[0.28em] opacity-50">MAGYC Admin</p>
        <h1 className="text-2xl font-semibold">
          {reason === "not_configured" ? de.admin.noAccessConfigured : de.admin.noAccess}
        </h1>
        <p className="text-sm leading-relaxed opacity-70">
          {de.admin.configureAccess}
        </p>
      </div>
    </main>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const gate = await requireAdmin();
  if (!gate.ok) return <GateMessage reason={gate.reason || "forbidden"} />;

  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q.trim().slice(0, 120) : "";
  const rawPage = Number.parseInt(resolvedSearchParams.page || "1", 10);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.min(rawPage, 10_000)) : 1;
  const data = await loadAdminData(gate.email || gate.userId || "admin", { query, page });
  data.migrationWarnings.unshift(`Data Contract ${CONTRACT_VERSION}`);
  return <AdminConsole initialData={data} />;
}
