import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  color: string | null;
  created_at: string;
};

type SpaceRow = {
  id: string;
  title: string;
  owner_id: string | null;
  visibility: string | null;
  language: string | null;
  modules: unknown[] | null;
  created_at: string;
  published_at: string | null;
};

type StateRow = {
  actor_kind: "user" | "anon";
  actor_id: string;
  kind: string;
  created_at: string;
};

type AiEventRow = {
  id: string;
  user_id: string | null;
  anon_id: string | null;
  space_id: string | null;
  module_index: number | null;
  event_type: string;
  model: string | null;
  status: "ok" | "error";
  input: string | null;
  output: string | null;
  error: string | null;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function clip(text: string | null | undefined, max = 180) {
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

async function loadAdminData() {
  const admin = supabaseAdmin();
  const [profilesRes, spacesRes, stateRes, aiEventsRes] = await Promise.all([
    admin.from("profiles").select("id, display_name, avatar_url, color, created_at").order("created_at", { ascending: false }).limit(250),
    admin.from("spaces").select("id, title, owner_id, visibility, language, modules, created_at, published_at").order("created_at", { ascending: false }).limit(250),
    admin.from("module_state").select("actor_kind, actor_id, kind, created_at").order("created_at", { ascending: false }).limit(1000),
    admin.from("ai_events").select("id, user_id, anon_id, space_id, module_index, event_type, model, status, input, output, error, latency_ms, tokens_in, tokens_out, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (spacesRes.error) throw spacesRes.error;
  if (stateRes.error) throw stateRes.error;

  const aiEventsMissing = Boolean(aiEventsRes.error);
  if (aiEventsRes.error) {
    console.warn("[admin] ai_events unavailable:", aiEventsRes.error.message);
  }

  const profiles = (profilesRes.data || []) as ProfileRow[];
  const spaces = (spacesRes.data || []) as SpaceRow[];
  const state = (stateRes.data || []) as StateRow[];
  const aiEvents = (aiEventsRes.data || []) as AiEventRow[];

  const spacesByOwner = new Map<string, number>();
  for (const space of spaces) {
    if (!space.owner_id) continue;
    spacesByOwner.set(space.owner_id, (spacesByOwner.get(space.owner_id) || 0) + 1);
  }

  const actionsByActor = new Map<string, number>();
  for (const entry of state) {
    const key = `${entry.actor_kind}:${entry.actor_id}`;
    actionsByActor.set(key, (actionsByActor.get(key) || 0) + 1);
  }

  const aiByUser = new Map<string, number>();
  for (const event of aiEvents) {
    const key = event.user_id ? `user:${event.user_id}` : event.anon_id ? `anon:${event.anon_id}` : "";
    if (!key) continue;
    aiByUser.set(key, (aiByUser.get(key) || 0) + 1);
  }

  const users = profiles.map((profile) => ({
    ...profile,
    spaces: spacesByOwner.get(profile.id) || 0,
    actions: actionsByActor.get(`user:${profile.id}`) || 0,
    aiRuns: aiByUser.get(`user:${profile.id}`) || 0,
  }));

  const anonActors = [...actionsByActor.entries()]
    .filter(([key]) => key.startsWith("anon:"))
    .slice(0, 40)
    .map(([key, actions]) => ({
      id: key.replace("anon:", ""),
      actions,
      aiRuns: aiByUser.get(key) || 0,
    }));

  const totalTokens = aiEvents.reduce((sum, event) => sum + (event.tokens_in || 0) + (event.tokens_out || 0), 0);
  const errors = aiEvents.filter((event) => event.status === "error").length;

  return { profiles: users, anonActors, spaces, aiEvents, aiEventsMissing, totalTokens, errors };
}

function GateMessage({ reason }: { reason: NonNullable<Awaited<ReturnType<typeof requireAdmin>>["reason"]> }) {
  if (reason === "signed_out") {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f6f6f3] text-[#111] px-6">
        <div className="max-w-sm space-y-4">
          <p className="mono text-[11px] tracking-widest uppercase opacity-50">MAGYC Admin</p>
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <SignInButton mode="modal">
            <button className="mono text-[11px] tracking-widest uppercase border border-black/20 px-4 py-2">
              sign in
            </button>
          </SignInButton>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center bg-[#f6f6f3] text-[#111] px-6">
      <div className="max-w-lg space-y-3">
        <p className="mono text-[11px] tracking-widest uppercase opacity-50">MAGYC Admin</p>
        <h1 className="text-2xl font-semibold">
          {reason === "not_configured" ? "Admin access is not configured" : "No admin access"}
        </h1>
        <p className="text-sm leading-relaxed opacity-70">
          Set `ADMIN_EMAILS` or `ADMIN_USER_IDS` in the deployment environment to enable this backend.
        </p>
      </div>
    </main>
  );
}

export default async function AdminPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <GateMessage reason={gate.reason || "forbidden"} />;

  const data = await loadAdminData();
  const latestSpaces = data.spaces.slice(0, 30);
  const latestEvents = data.aiEvents.slice(0, 50);

  return (
    <main className="min-h-screen bg-[#f6f6f3] text-[#111]">
      <div className="mx-auto max-w-7xl px-5 py-6 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-5">
          <div>
            <p className="mono text-[11px] tracking-widest uppercase opacity-50">MAGYC Admin</p>
            <h1 className="text-3xl font-semibold tracking-normal">Operations</h1>
          </div>
          <div className="mono text-[10px] tracking-widest uppercase opacity-55">
            signed in as {gate.email || gate.userId}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="users" value={data.profiles.length} />
          <Metric label="spaces" value={data.spaces.length} />
          <Metric label="ai events" value={data.aiEvents.length} muted={data.aiEventsMissing ? "migration pending" : undefined} />
          <Metric label="tokens logged" value={data.totalTokens.toLocaleString("de-DE")} muted={`${data.errors} errors`} />
        </section>

        {data.aiEventsMissing && (
          <div className="border border-amber-500/30 bg-amber-100/40 px-4 py-3 text-sm">
            `ai_events` is not available yet. Apply `supabase/migrations/009_ai_events_admin.sql`
            in Supabase to enable AI logs.
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
          <Panel title="Users">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="mono text-[10px] tracking-widest uppercase opacity-50">
                  <tr className="text-left border-b border-black/10">
                    <th className="py-2 pr-3">name</th>
                    <th className="py-2 pr-3">spaces</th>
                    <th className="py-2 pr-3">actions</th>
                    <th className="py-2 pr-3">ai</th>
                  </tr>
                </thead>
                <tbody>
                  {data.profiles.map((user) => (
                    <tr key={user.id} className="border-b border-black/5">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{user.display_name || user.id.slice(-8)}</div>
                        <div className="mono text-[10px] opacity-45">{user.id}</div>
                      </td>
                      <td className="py-2 pr-3">{user.spaces}</td>
                      <td className="py-2 pr-3">{user.actions}</td>
                      <td className="py-2 pr-3">{user.aiRuns}</td>
                    </tr>
                  ))}
                  {data.profiles.length === 0 && (
                    <tr><td className="py-6 opacity-50" colSpan={4}>No signed-in users yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Spaces">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="mono text-[10px] tracking-widest uppercase opacity-50">
                  <tr className="text-left border-b border-black/10">
                    <th className="py-2 pr-3">space</th>
                    <th className="py-2 pr-3">owner</th>
                    <th className="py-2 pr-3">visibility</th>
                    <th className="py-2 pr-3">created</th>
                  </tr>
                </thead>
                <tbody>
                  {latestSpaces.map((space) => (
                    <tr key={space.id} className="border-b border-black/5">
                      <td className="py-2 pr-3 min-w-[220px]">
                        <Link href={`/s/${space.id}`} className="font-medium underline decoration-black/20 underline-offset-2">
                          {space.title || space.id}
                        </Link>
                        <div className="mono text-[10px] opacity-45">
                          {space.id} · {Array.isArray(space.modules) ? space.modules.length : 0} modules · {space.language || "?"}
                        </div>
                      </td>
                      <td className="py-2 pr-3 mono text-[10px] opacity-70">{space.owner_id || "draft"}</td>
                      <td className="py-2 pr-3">{space.visibility || "draft"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(space.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <Panel title="Anon actors">
            <div className="space-y-2">
              {data.anonActors.map((actor) => (
                <div key={actor.id} className="flex items-center justify-between border-b border-black/5 pb-2">
                  <span className="mono text-[10px] opacity-65">{actor.id}</span>
                  <span className="text-sm">{actor.actions} actions · {actor.aiRuns} AI</span>
                </div>
              ))}
              {data.anonActors.length === 0 && <p className="text-sm opacity-50">No anonymous actors yet.</p>}
            </div>
          </Panel>

          <Panel title="AI logs">
            <div className="space-y-3">
              {latestEvents.map((event) => (
                <article key={event.id} className="border-b border-black/8 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mono text-[10px] tracking-widest uppercase">{event.event_type}</span>
                    <span className="mono text-[10px] opacity-50">{event.status}</span>
                    <span className="mono text-[10px] opacity-50">{event.latency_ms ?? "-"}ms</span>
                    <span className="mono text-[10px] opacity-50">
                      {(event.tokens_in || 0) + (event.tokens_out || 0)} tok
                    </span>
                    {event.space_id && (
                      <Link href={`/s/${event.space_id}`} className="mono text-[10px] underline opacity-60">
                        {event.space_id}
                      </Link>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed opacity-75">{clip(event.input)}</p>
                  {event.error ? (
                    <p className="mt-1 text-sm text-[#7a1f1f]">{clip(event.error, 240)}</p>
                  ) : (
                    <p className="mt-1 text-xs leading-relaxed opacity-45">{clip(event.output, 240)}</p>
                  )}
                  <div className="mono mt-1 text-[10px] opacity-40">{formatDate(event.created_at)}</div>
                </article>
              ))}
              {latestEvents.length === 0 && (
                <p className="text-sm opacity-50">
                  No AI logs yet. They will appear after the migration is applied and a new AI call runs.
                </p>
              )}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, muted }: { label: string; value: string | number; muted?: string }) {
  return (
    <div className="border border-black/10 bg-white px-4 py-3">
      <div className="mono text-[10px] tracking-widest uppercase opacity-45">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {muted && <div className="mono mt-1 text-[10px] tracking-widest uppercase opacity-40">{muted}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-black/10 bg-white p-4">
      <h2 className="mono text-[11px] tracking-widest uppercase opacity-55 mb-3">{title}</h2>
      {children}
    </section>
  );
}
