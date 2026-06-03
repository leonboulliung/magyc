"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface AdminUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  banned: boolean;
  created_at: string;
}

interface AdminReport {
  id: string;
  reason: string;
  detail: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  target_kind: "card" | "profile";
  target_card_id: string | null;
  target_profile_id: string | null;
  reporter: { id: string; display_name: string; avatar_url: string | null } | null;
  target_card: {
    id: string;
    kind: string;
    title: string;
    archived: boolean;
    owner: { id: string; display_name: string; banned: boolean } | null;
  } | null;
  target_profile: { id: string; display_name: string; banned: boolean } | null;
}

type Tab = "reports" | "users";

export function AdminConsole() {
  const [tab, setTab] = useState<Tab>("reports");

  return (
    <div>
      <div className="border-b border-rule-strong px-4 sm:px-8 py-4 flex items-baseline justify-between">
        <h1 className="editorial font-black text-[28px] sm:text-[36px] leading-none">
          Admin
        </h1>
        <Link href="/" className="mono text-[10px] tracking-widest hover:underline">
          ← BACK TO PARIS
        </Link>
      </div>

      <div className="border-b border-rule-strong px-4 sm:px-8 flex">
        {(["reports", "users"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 mono text-[11px] tracking-widest border-r border-rule-strong ${tab === t ? "bg-ink text-paper" : "bg-paper text-ink"}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="px-4 sm:px-8 py-6 max-w-5xl mx-auto">
        {tab === "reports" ? <ReportsPanel /> : <UsersPanel />}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// REPORTS
// ────────────────────────────────────────────────────────────────────────────
function ReportsPanel() {
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setReports(null);
    const q = showAll ? "?all=1" : "";
    fetch(`/api/admin/reports${q}`)
      .then((r) => r.json())
      .then((j) => setReports(Array.isArray(j.reports) ? j.reports : []))
      .catch(() => setReports([]));
  }, [showAll]);

  useEffect(() => {
    load();
  }, [load]);

  async function setResolved(id: string, resolved: boolean) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="mono text-[11px] tracking-widest opacity-70">
          {reports == null
            ? "LOADING…"
            : `${reports.length} ${showAll ? "TOTAL" : "OPEN"}`}
        </div>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full border border-rule-strong hover:bg-ink hover:text-paper"
        >
          {showAll ? "OPEN ONLY" : "SHOW ALL"}
        </button>
      </div>

      {reports != null && reports.length === 0 && (
        <p className="mono text-[12px] opacity-60 py-12 text-center">
          {showAll ? "Nothing reported yet." : "Inbox zero. ✓"}
        </p>
      )}

      {reports?.map((r) => {
        const isCard = r.target_kind === "card";
        const targetHref = isCard
          ? r.target_card_id
            ? `/post/${r.target_card_id}`
            : null
          : r.target_profile_id
            ? `/u/${r.target_profile_id}`
            : null;
        const targetName = isCard
          ? r.target_card?.title || "(deleted card)"
          : r.target_profile?.display_name
            ? `@${r.target_profile.display_name}`
            : "(deleted profile)";
        const targetOwner = isCard ? r.target_card?.owner : r.target_profile;
        return (
          <div
            key={r.id}
            className="border border-rule rounded-2xl p-4 space-y-2 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="mono text-[10px] tracking-widest opacity-70 flex items-center gap-2 flex-wrap">
                <span className="tag">{r.reason.toUpperCase()}</span>
                <span>· {r.target_kind.toUpperCase()}</span>
                <span>· {new Date(r.created_at).toLocaleString()}</span>
                {r.resolved && (
                  <span className="tag opacity-60">RESOLVED</span>
                )}
                {targetOwner?.banned && (
                  <span className="tag bg-ink text-paper">OWNER BANNED</span>
                )}
              </div>
            </div>
            <div className="text-[14px]">
              {targetHref ? (
                <Link
                  href={targetHref}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                >
                  {targetName} ↗
                </Link>
              ) : (
                <span className="opacity-60">{targetName}</span>
              )}
            </div>
            {r.detail && (
              <p className="text-[13px] opacity-80 whitespace-pre-wrap">
                {r.detail}
              </p>
            )}
            <div className="mono text-[10px] opacity-60 flex items-center justify-between gap-2 flex-wrap pt-1">
              <div>
                Reported by{" "}
                {r.reporter ? (
                  <Link
                    href={`/u/${r.reporter.id}`}
                    className="hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    @{r.reporter.display_name}
                  </Link>
                ) : (
                  "(unknown)"
                )}
              </div>
              <div className="flex items-center gap-2">
                {r.resolved ? (
                  <button
                    onClick={() => setResolved(r.id, false)}
                    disabled={busyId === r.id}
                    className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full border border-rule-strong hover:bg-ink hover:text-paper"
                  >
                    REOPEN
                  </button>
                ) : (
                  <button
                    onClick={() => setResolved(r.id, true)}
                    disabled={busyId === r.id}
                    className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full border border-rule-strong bg-ink text-paper"
                  >
                    {busyId === r.id ? "…" : "RESOLVE"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// USERS
// ────────────────────────────────────────────────────────────────────────────
function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setUsers(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/admin/users${params.toString() ? "?" + params : ""}`)
      .then((r) => r.json())
      .then((j) => setUsers(Array.isArray(j.users) ? j.users : []))
      .catch(() => setUsers([]));
  }, [q]);

  useEffect(() => {
    const h = window.setTimeout(load, 200);
    return () => window.clearTimeout(h);
  }, [load]);

  async function setBanned(id: string, banned: boolean) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ banned }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search username or id…"
          className="input flex-1"
        />
        <div className="mono text-[10px] tracking-widest opacity-60">
          {users == null ? "…" : `${users.length}`}
        </div>
      </div>

      {users != null && users.length === 0 && (
        <p className="mono text-[12px] opacity-60 py-12 text-center">
          No users.
        </p>
      )}

      <div className="divide-y divide-rule border border-rule rounded-2xl overflow-hidden">
        {users?.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-8 h-8 rounded-full border border-rule-strong overflow-hidden bg-ink/10 shrink-0">
              {u.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={u.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/u/${u.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-[14px] font-medium hover:underline truncate block"
              >
                @{u.display_name}
              </Link>
              <div className="mono text-[10px] opacity-50 truncate">
                {u.id}
              </div>
            </div>
            {u.banned && (
              <span className="tag bg-ink text-paper shrink-0">BANNED</span>
            )}
            <button
              onClick={() => setBanned(u.id, !u.banned)}
              disabled={busyId === u.id}
              className={`mono text-[10px] tracking-widest px-2.5 py-1 rounded-full border shrink-0 ${
                u.banned
                  ? "border-rule-strong hover:bg-ink hover:text-paper"
                  : "border-rule-strong hover:bg-ink hover:text-paper"
              }`}
            >
              {busyId === u.id ? "…" : u.banned ? "UNBAN" : "BAN"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
