"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import {
  ACCOUNT_STATUSES,
  ADMIN_PLANS,
  planLabel,
  statusLabel,
  supportTypeLabel,
  type AccountStatus,
  type AdminPlan,
  type SupportStatus,
} from "@/lib/adminAccount";
import { readApiJson, showActionSuccess, showApiError, showUnknownError } from "@/lib/client/feedback";

export type AdminUser = {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  plan: AdminPlan;
  accountStatus: AccountStatus;
  adminNotes: string;
  spaces: number;
  actions: number;
  aiRuns: number;
  lastSeen: string | null;
};

export type AdminSpace = {
  id: string;
  title: string;
  ownerId: string | null;
  phase: string;
  segment: string | null;
  moduleCount: number;
  uploadCount: number;
  uploadBytes: number;
  createdAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
};

export type AdminTicket = {
  id: string;
  userId: string | null;
  email: string | null;
  type: string;
  status: SupportStatus;
  message: string;
  route: string | null;
  spaceId: string | null;
  lastError: string | null;
  createdAt: string;
  doneAt: string | null;
};

export type TimelineEntry = {
  id: string;
  userId: string | null;
  label: string;
  detail: string;
  at: string;
  href?: string;
};

export type AdminConsoleData = {
  signedInAs: string;
  migrationWarnings: string[];
  metrics: {
    users: number;
    activeUsers7d: number;
    spaces: number;
    spaces7d: number;
    openTickets: number;
    aiErrors: number;
    appErrors: number;
    uploadedBytes: number;
  };
  users: AdminUser[];
  spaces: AdminSpace[];
  tickets: AdminTicket[];
  timeline: TimelineEntry[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toLocaleString("de-DE", { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}

function shortId(id: string | null | undefined) {
  return id ? id.slice(-8) : "-";
}

export function AdminConsole({ initialData }: { initialData: AdminConsoleData }) {
  const [users, setUsers] = useState(initialData.users);
  const [tickets, setTickets] = useState(initialData.tickets);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialData.users[0]?.id || null);
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === modalUserId) || null,
    [modalUserId, users],
  );
  const focusedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [selectedUserId, users],
  );
  const focusedSpaces = useMemo(
    () => initialData.spaces.filter((space) => space.ownerId === selectedUserId),
    [initialData.spaces, selectedUserId],
  );
  const focusedTimeline = useMemo(
    () => initialData.timeline.filter((entry) => entry.userId === selectedUserId).slice(0, 18),
    [initialData.timeline, selectedUserId],
  );
  const focusedTickets = useMemo(
    () => tickets.filter((ticket) => ticket.userId === selectedUserId),
    [tickets, selectedUserId],
  );
  const modalSpaces = useMemo(
    () => initialData.spaces.filter((space) => space.ownerId === modalUserId),
    [initialData.spaces, modalUserId],
  );
  const modalTimeline = useMemo(
    () => initialData.timeline.filter((entry) => entry.userId === modalUserId).slice(0, 18),
    [initialData.timeline, modalUserId],
  );
  const modalTickets = useMemo(
    () => tickets.filter((ticket) => ticket.userId === modalUserId),
    [tickets, modalUserId],
  );
  const openTickets = tickets.filter((ticket) => ticket.status === "new");

  function openUser(userId: string) {
    setSelectedUserId(userId);
    setModalUserId(userId);
  }

  async function updateUser(userId: string, patch: { plan?: AdminPlan; status?: AccountStatus; adminNotes?: string }) {
    const reason = window.prompt("Grund fuer die Admin-Aenderung (optional)") || "";
    setBusy(`user:${userId}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, reason }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        showApiError("Nutzer nicht aktualisiert", json);
        return;
      }
      setUsers((prev) => prev.map((user) => user.id === userId
        ? {
          ...user,
          plan: patch.plan ?? user.plan,
          accountStatus: patch.status ?? user.accountStatus,
          adminNotes: patch.adminNotes ?? user.adminNotes,
        }
        : user));
      showActionSuccess("Nutzer aktualisiert");
    } catch (error) {
      showUnknownError("Nutzer nicht aktualisiert", error);
    } finally {
      setBusy(null);
    }
  }

  async function updateTicket(ticketId: string, status: SupportStatus) {
    setBusy(`ticket:${ticketId}`);
    try {
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await readApiJson(res);
      if (!res.ok) {
        showApiError("Ticket nicht aktualisiert", json);
        return;
      }
      const now = new Date().toISOString();
      setTickets((prev) => prev.map((ticket) => ticket.id === ticketId
        ? { ...ticket, status, doneAt: status === "done" ? now : null }
        : ticket));
      showActionSuccess(status === "done" ? "Ticket erledigt" : "Ticket wieder geoeffnet");
    } catch (error) {
      showUnknownError("Ticket nicht aktualisiert", error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f4f1] text-[#17171a]">
      <div className="mx-auto max-w-7xl px-5 py-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-5">
          <div>
            <p className="mono text-[11px] uppercase tracking-[0.28em] text-black/45">MAGYC Admin</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal">Launch Cockpit</h1>
          </div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-black/45">
            angemeldet als {initialData.signedInAs}
          </div>
        </header>

        {initialData.migrationWarnings.map((warning) => (
          <div key={warning} className="mt-4 rounded-[18px] border border-amber-500/25 bg-amber-100/45 px-4 py-3 text-sm text-amber-950/80">
            {warning}
          </div>
        ))}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Nutzer" value={initialData.metrics.users} muted={`${initialData.metrics.activeUsers7d} aktiv / 7 Tage`} />
          <Metric label="Projekte" value={initialData.metrics.spaces} muted={`${initialData.metrics.spaces7d} neu / 7 Tage`} />
          <Metric label="Support offen" value={openTickets.length} muted={`${tickets.length} gesamt`} />
          <Metric label="Medien" value={formatBytes(initialData.metrics.uploadedBytes)} muted={`${initialData.metrics.aiErrors + initialData.metrics.appErrors} Fehler geloggt`} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Support Eingang">
            <div className="space-y-3">
              {(openTickets.length ? openTickets : tickets.slice(0, 5)).map((ticket) => (
                <article key={ticket.id} className="rounded-[22px] border border-black/10 bg-white/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-black px-3 py-1 text-xs text-white">{supportTypeLabel(ticket.type)}</span>
                        <span className="text-sm text-black/45">{formatDate(ticket.createdAt)}</span>
                      </div>
                      <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-black/75">{ticket.message}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-black/45">
                        <span>{ticket.email || shortId(ticket.userId)}</span>
                        {ticket.route && <span>{ticket.route}</span>}
                        {ticket.spaceId && <Link href={`/s/${ticket.spaceId}`} className="underline">Projekt {shortId(ticket.spaceId)}</Link>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateTicket(ticket.id, ticket.status === "done" ? "new" : "done")}
                      disabled={busy === `ticket:${ticket.id}`}
                      className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-40"
                    >
                      {ticket.status === "done" ? "Wieder oeffnen" : "Erledigt"}
                    </button>
                  </div>
                </article>
              ))}
              {tickets.length === 0 && <p className="text-sm text-black/45">Noch keine Support-Tickets.</p>}
            </div>
          </Panel>

          <Panel title="Nutzer Fokus">
            {focusedUser ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">{focusedUser.displayName}</h2>
                    <p className="text-sm text-black/50">{focusedUser.email || focusedUser.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openUser(focusedUser.id)}
                    className="rounded-full border border-black/15 px-4 py-2 text-sm"
                  >
                    Read-only ansehen
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniMetric label="Plan" value={planLabel(focusedUser.plan)} />
                  <MiniMetric label="Status" value={statusLabel(focusedUser.accountStatus)} />
                  <MiniMetric label="Projekte" value={focusedSpaces.length} />
                </div>
                <Timeline entries={focusedTimeline} />
              </div>
            ) : (
              <p className="text-sm text-black/45">Noch kein Nutzer ausgewaehlt.</p>
            )}
          </Panel>
        </section>

        <Panel title="Nutzerverwaltung" className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="mono text-[10px] uppercase tracking-[0.24em] text-black/40">
                <tr className="border-b border-black/10 text-left">
                  <th className="px-4 py-3">Nutzer</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aktivitaet</th>
                  <th className="px-4 py-3">Admin-Notiz</th>
                  <th className="px-4 py-3 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={`border-b border-black/8 ${selectedUserId === user.id ? "bg-black/[0.03]" : ""}`}>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => setSelectedUserId(user.id)} className="text-left">
                        <div className="font-semibold">{user.displayName || shortId(user.id)}</div>
                        <div className="text-xs text-black/45">{user.email || user.id}</div>
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={user.plan}
                        onChange={(event) => updateUser(user.id, { plan: event.target.value as AdminPlan })}
                        className="rounded-full border border-black/15 bg-white px-3 py-2"
                      >
                        {ADMIN_PLANS.map((plan) => <option key={plan} value={plan}>{planLabel(plan)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={user.accountStatus}
                        onChange={(event) => updateUser(user.id, { status: event.target.value as AccountStatus })}
                        className="rounded-full border border-black/15 bg-white px-3 py-2"
                      >
                        {ACCOUNT_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4 text-black/55">
                      {user.spaces} Projekte · {user.actions} Aktionen · {user.aiRuns} KI
                      <div className="text-xs">zuletzt {formatDate(user.lastSeen)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <input
                        defaultValue={user.adminNotes}
                        onBlur={(event) => {
                          if (event.target.value !== user.adminNotes) updateUser(user.id, { adminNotes: event.target.value });
                        }}
                        className="w-full rounded-full border border-black/15 bg-white px-3 py-2 text-sm"
                        placeholder="Interne Notiz"
                      />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openUser(user.id)}
                        className="rounded-full border border-black/15 px-4 py-2"
                      >
                        Ansehen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 backdrop-blur-sm">
          <section className="max-h-[88vh] w-full max-w-5xl overflow-auto rounded-[30px] border border-black/10 bg-[#f4f4f1] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-5">
              <div>
                <p className="mono text-[11px] uppercase tracking-[0.28em] text-black/45">Read-only Account View</p>
                <h2 className="mt-2 text-3xl font-semibold">{selectedUser.displayName}</h2>
                <p className="text-sm text-black/50">{selectedUser.email || selectedUser.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalUserId(null)}
                className="grid h-11 w-11 place-items-center rounded-full border border-black/15"
                aria-label="Ansicht schliessen"
              >
                <Icon icon="lucide:x" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  <MiniMetric label="Plan" value={planLabel(selectedUser.plan)} />
                  <MiniMetric label="Status" value={statusLabel(selectedUser.accountStatus)} />
                  <MiniMetric label="Projekte" value={modalSpaces.length} />
                  <MiniMetric label="Support" value={modalTickets.length} />
                </div>
                <div className="rounded-[24px] border border-black/10 bg-white/55 p-4">
                  <h3 className="mono text-[11px] uppercase tracking-[0.22em] text-black/45">Projekte</h3>
                  <div className="mt-3 space-y-2">
                    {modalSpaces.map((space) => (
                      <Link key={space.id} href={`/s/${space.id}`} className="block rounded-[18px] border border-black/8 px-4 py-3 hover:bg-white">
                        <div className="font-medium">{space.title}</div>
                        <div className="text-xs text-black/45">
                          {space.phase} · {space.moduleCount} Elemente · {formatDate(space.createdAt)}
                        </div>
                      </Link>
                    ))}
                    {modalSpaces.length === 0 && <p className="text-sm text-black/45">Keine Projekte.</p>}
                  </div>
                </div>
              </div>
              <div className="space-y-5">
                <div className="rounded-[24px] border border-black/10 bg-white/55 p-4">
                  <h3 className="mono text-[11px] uppercase tracking-[0.22em] text-black/45">Aktivitaet</h3>
                  <Timeline entries={modalTimeline} />
                </div>
                <div className="rounded-[24px] border border-black/10 bg-white/55 p-4">
                  <h3 className="mono text-[11px] uppercase tracking-[0.22em] text-black/45">Support</h3>
                  <div className="mt-3 space-y-2">
                    {modalTickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-[18px] border border-black/8 px-4 py-3">
                        <div className="flex justify-between gap-3">
                          <span className="font-medium">{supportTypeLabel(ticket.type)}</span>
                          <span className="text-xs text-black/45">{formatDate(ticket.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-black/65">{ticket.message}</p>
                      </div>
                    ))}
                    {modalTickets.length === 0 && <p className="text-sm text-black/45">Keine Tickets.</p>}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, muted }: { label: string; value: string | number; muted?: string }) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-white/65 p-4">
      <div className="mono text-[10px] uppercase tracking-[0.24em] text-black/40">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {muted && <div className="mt-1 text-xs text-black/45">{muted}</div>}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[18px] border border-black/8 bg-white/55 p-3">
      <div className="mono text-[9px] uppercase tracking-[0.2em] text-black/35">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[30px] border border-black/10 bg-white/45 p-4 sm:p-5 ${className}`}>
      <h2 className="mono mb-4 text-[11px] uppercase tracking-[0.25em] text-black/45">{title}</h2>
      {children}
    </section>
  );
}

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="mt-3 space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#8b7cff]" />
          <div>
            <div className="text-sm font-medium">{entry.label}</div>
            <div className="text-xs leading-5 text-black/45">
              {entry.href ? <Link href={entry.href} className="underline">{entry.detail}</Link> : entry.detail} · {formatDate(entry.at)}
            </div>
          </div>
        </div>
      ))}
      {entries.length === 0 && <p className="text-sm text-black/45">Noch keine Aktivitaet sichtbar.</p>}
    </div>
  );
}
