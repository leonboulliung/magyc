"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SignUpButton, useUser } from "@clerk/nextjs";
import { Header } from "@/components/Header";
import { ParisMap } from "@/components/ParisMap";
import { ReportButton } from "@/components/ReportButton";
import { ModuleArea } from "@/components/modules/ModuleArea";
import { RolesArea } from "@/components/RolesArea";
import { RolesEditor } from "@/components/RolesEditor";
import { KlarheitBar } from "@/components/KlarheitBar";
import { placeKindLabel } from "@/lib/placeKind";
import { cardColor, isDark } from "@/lib/color";
import { fetchCardById } from "@/lib/db";
import { useRealtimeCards } from "@/lib/realtime";
import type { Card } from "@/lib/types";
import { timeAgo, fullStartLabel, parisClockLabel } from "@/lib/time";
import { shareCard } from "@/lib/share";

export function PostDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [card, setCard] = useState<Card | null>(null);
  const [loaded, setLoaded] = useState(false);
  // A "just created / just transformed" banner. `new` = idea | thing | 1.
  const [justPosted, setJustPosted] = useState<boolean>(false);
  useEffect(() => {
    const v = searchParams.get("new");
    if (v) {
      setJustPosted(true);
      window.history.replaceState(null, "", `/post/${id}`);
      const t = window.setTimeout(() => setJustPosted(false), 5000);
      return () => window.clearTimeout(t);
    }
  }, [searchParams, id]);
  const [sharing, setSharing] = useState(false);
  const [shareHint, setShareHint] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    description: string;
    spots: number;
    permission: "public" | "request";
    roles: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  // AI-suggested role labels for the EditModal's RolesEditor. Owner taps
  // "✨ AI VORSCHLAG" → chips appear → owner taps each to add.
  const [roleSuggestions, setRoleSuggestions] = useState<string[]>([]);
  const [suggestingRoles, setSuggestingRoles] = useState(false);


  const { user } = useUser();

  const refresh = useCallback(() => {
    fetchCardById(id)
      .then((c) => { setCard(c); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeCards(refresh);

  if (!loaded) return <div className="h-[100dvh] bg-paper" />;
  if (!card) {
    return (
      <div className="app-shell">
        <Header />
        <main className="animate-fadeIn">
          <div className="min-h-full grid place-items-center px-6 py-20">
            <div className="text-center">
              <div className="editorial font-black text-[40px]">Not found.</div>
              <p className="mono text-[12px] mt-2 opacity-70">
                It may have been removed or never existed.
              </p>
              <Link href="/" className="btn mt-6 inline-block">← Back to Paris</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const color = cardColor(card);
  const dark = isDark(color);
  // Editorial-weight axis derived from the signature; clamped to the
  // [600, 900] band so the page never reads "thin" (we're an editorial
  // system, not a wireframe). Defaults to the existing black weight
  // when no signature has landed yet.
  const titleWeight = card.signature
    ? Math.max(600, Math.min(900, card.signature.weight))
    : 900;
  const titleStyle = {
    fontWeight: titleWeight,
    fontVariationSettings: `"wght" ${titleWeight}`,
  } as const;
  const headlineTag = card.tags?.[0]?.toUpperCase() || "CARD";
  const mine = !!user && user.id === card.ownerId;
  const joinedMembers = card.members.filter((m) => m.state === "joined");
  const requestedMembers = card.members.filter((m) => m.state === "requested");
  const joined = !!user && joinedMembers.some((m) => m.userId === user.id);
  const requested = !!user && requestedMembers.some((m) => m.userId === user.id);
  const full = card.spots != null && joinedMembers.length >= card.spots;

  async function onShare() {
    if (!card) return;
    setSharing(true);
    setShareHint("");
    try {
      const result = await shareCard(card);
      if (result === "copied") setShareHint("LINK COPIED ✓");
      else if (result === "shared") setShareHint("SHARED ✓");
      else if (result === "downloaded") setShareHint("POSTER SAVED ✓");
      window.setTimeout(() => setShareHint(""), 2500);
    } finally {
      setSharing(false);
    }
  }

  async function doJoin() {
    if (!card) return;
    setBusy(true);
    try { await fetch(`/api/cards/${card.id}/join`, { method: "POST" }); refresh(); }
    finally { setBusy(false); }
  }
  async function doLeave() {
    if (!card) return;
    setBusy(true);
    try { await fetch(`/api/cards/${card.id}/join`, { method: "DELETE" }); refresh(); }
    finally { setBusy(false); }
  }
  async function doAccept(uid: string) {
    if (!card) return;
    await fetch(`/api/cards/${card.id}/members/${uid}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "joined" }),
    });
    refresh();
  }
  async function doDecline(uid: string) {
    if (!card) return;
    await fetch(`/api/cards/${card.id}/members/${uid}`, { method: "DELETE" });
    refresh();
  }
  async function doRemoveMember(uid: string) {
    if (!card) return;
    if (!confirm("Remove this person from the crew?")) return;
    await fetch(`/api/cards/${card.id}/members/${uid}`, { method: "DELETE" });
    refresh();
  }
  async function doSetRole(uid: string, role: string) {
    if (!card) return;
    await fetch(`/api/cards/${card.id}/members/${uid}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    refresh();
  }

  function startEdit() {
    if (!card) return;
    setDraft({
      title: card.title,
      description: card.description,
      spots: card.spots ?? 1,
      permission: card.permission ?? "public",
      roles: card.roles.map((r) => r.label),
    });
    setEditing(true);
  }
  async function saveEdit() {
    if (!card || !draft) return;
    setBusy(true);
    try {
      await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      setEditing(false);
      refresh();
    } finally { setBusy(false); }
  }
  async function suggestRoles() {
    if (!card || suggestingRoles) return;
    setSuggestingRoles(true);
    try {
      const res = await fetch(`/api/cards/${card.id}/suggest-roles`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        roles?: unknown;
      };
      if (Array.isArray(json.roles)) {
        setRoleSuggestions(
          json.roles.filter((r): r is string => typeof r === "string"),
        );
      }
    } finally {
      setSuggestingRoles(false);
    }
  }
  async function removeCard() {
    if (!card) return;
    if (!confirm("Delete this card?")) return;
    await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
    router.push("/");
  }

  // Banner copy is the same for every freshly-posted card now.
  const bannerText = justPosted ? "✓ POSTED · SHARE IT TO FIND YOUR CREW" : "";

  return (
    <div className="app-shell">
      <Header />
      {justPosted && (
        <div className="shrink-0 bg-ink text-paper mono text-[11px] tracking-widest px-4 sm:px-8 py-2.5 flex items-center gap-2 animate-fadeIn">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-paper animate-twinkle" />
          {bannerText}
          <button
            onClick={() => setJustPosted(false)}
            className="ml-auto opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <main className="animate-fadeIn">

      {/* HERO — the map, when there is one. Otherwise a quiet paper
          band so the title can breathe without a wireframe gap. */}
      <div className="relative h-[36vh] sm:h-[44vh] border-b border-rule overflow-hidden bg-paper">
        {card.location ? (
          <div className="absolute inset-0 pointer-events-none bg-paper">
            <ParisMap cards={[card]} highlightId={card.id} focusedCard={card} />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center mono text-[10px] tracking-widest opacity-50">
            NO LOCATION · OPEN
          </div>
        )}
      </div>

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-6 max-w-4xl w-full mx-auto space-y-6">
        <div>
          <div className="mono text-[10px] tracking-widest opacity-80">
            {headlineTag}
          </div>
          <h1 className="editorial font-black text-[42px] sm:text-[88px] leading-[0.95] max-w-[20ch] mt-2" style={titleStyle}>
            {card.title}
          </h1>
        </div>

        {/* author + meta row */}
        <div className="flex items-center gap-3 mono text-[11px]">
          {card.owner.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.owner.avatarUrl} alt="" className="w-10 h-10 rounded-full border border-rule-strong object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full border border-rule-strong bg-ink/10" aria-hidden />
          )}
          <div>
            <Link href={`/u/${card.owner.id}`} className="hover:underline">@{card.owner.displayName}</Link>
            <div className="opacity-60">{timeAgo(card.createdAt)} ago</div>
          </div>
          <div className="ml-auto flex items-center gap-3 flex-wrap justify-end">
            <span className="tag">{card.permission === "request" ? "REQUEST" : "PUBLIC"}</span>
            <span className="tabular-nums">{joinedMembers.length}/{card.spots ?? "—"} PEOPLE</span>
          </div>
        </div>

        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.tags.map((t) => (
              <span key={t} className="mono text-[10px] tracking-widest rounded-full border border-rule-strong text-ink-soft px-2.5 py-1">
                #{t.toUpperCase()}
              </span>
            ))}
          </div>
        )}

        {/* KLARHEIT — derived legibility status. */}
        <KlarheitBar card={card} showMissing={mine} />

        {/* MODULE area — the typed sub-surface the AI proposes and the
            owner curates. */}
        <ModuleArea card={card} mine={mine} onChanged={refresh} />

        {card.description && (
          <p className="text-[18px] leading-[1.5] whitespace-pre-wrap max-w-2xl">
            {card.description}
          </p>
        )}

        {/* Time / Place tiles. Only render if there's something to show. */}
        {(card.startsAt || card.location) && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[14px]">
              {card.startsAt && (
              <div className="panel p-4 flex items-center justify-center gap-2.5 text-center">
                <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" strokeLinecap="round" />
                </svg>
                <div className="leading-snug">
                  {fullStartLabel(card.startsAt)}
                  {card.endsAt && (
                    <span className="opacity-60"> – {parisClockLabel(card.endsAt)}</span>
                  )}
                </div>
              </div>
              )}
              {/* Place — pin glyph + label + open-in-maps. */}
              <div className="panel p-4 flex items-center justify-center gap-2.5 text-center">
                <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11Z" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <div className="min-w-0 leading-snug">
                  <div className="truncate">{card.location?.label || "—"}</div>
                  {(() => {
                    const kind = placeKindLabel(card.locationKind);
                    return kind ? (
                      <div className="mono text-[9px] tracking-widest opacity-60 mt-1">{kind}</div>
                    ) : null;
                  })()}
                  {card.location && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${card.location.lat},${card.location.lng}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100 underline underline-offset-2 mt-1 inline-block"
                    >
                      OPEN IN MAPS ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

          </>
        )}

        {/* ===================== ACTIONS ===================== */}
        {(
          <div className="flex flex-wrap gap-2 pt-2">
            {!mine && user && (
              <>
                {!joined && !requested && !full && (
                  <button onClick={doJoin} disabled={busy} className="btn">
                    {card.permission === "request" ? "REQUEST TO JOIN →" : "JOIN →"}
                  </button>
                )}
                {(joined || requested) && (
                  <button onClick={doLeave} disabled={busy} className="btn ghost">
                    {joined ? "LEAVE" : "CANCEL REQUEST"}
                  </button>
                )}
                {joined && <span className="tag">YOU&rsquo;RE IN ✓</span>}
                {requested && <span className="tag">REQUEST PENDING</span>}
                {full && !joined && !requested && <span className="tag">FULL</span>}
              </>
            )}
            {mine && (
              <>
                <button onClick={startEdit} className="btn ghost">EDIT</button>
                <button onClick={removeCard} className="btn ghost">DELETE</button>
              </>
            )}
            {!user && !mine && !full && (
              <SignUpButton mode="modal" forceRedirectUrl={`/onboarding?next=/post/${card.id}`}>
                <button className="btn">
                  {card.permission === "request" ? "SIGN UP TO REQUEST →" : "SIGN UP TO JOIN →"}
                </button>
              </SignUpButton>
            )}
            <div className="ml-auto flex items-center gap-2">
              {shareHint && <span className="mono text-[10px] tracking-widest opacity-70 animate-fadeIn">{shareHint}</span>}
              <button onClick={onShare} className="btn ghost" disabled={sharing}>{sharing ? "SHARING…" : "↗ SHARE"}</button>
            </div>
          </div>
        )}

        {/* Pending requests — owner-only view. */}
        {mine && requestedMembers.length > 0 && (
          <div className="border border-rule rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 mono text-[10px] tracking-widest bg-ink text-paper">
              PENDING REQUESTS · {requestedMembers.length}
            </div>
            <ul>
              {requestedMembers.map((r) => (
                <li key={r.userId} className="flex items-center justify-between px-3 py-2 border-t border-rule">
                  <div className="mono text-[12px]">@{r.user.displayName}</div>
                  <div className="flex gap-2">
                    <button onClick={() => doAccept(r.userId)} className="mono text-[10px] tracking-widest px-3 py-1 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors">ACCEPT</button>
                    <button onClick={() => doDecline(r.userId)} className="mono text-[10px] tracking-widest px-3 py-1 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors">DECLINE</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Predefined roles — only renders if card.roles is non-empty. */}
        <RolesArea card={card} onChanged={refresh} />

        <div className="border border-rule rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 mono text-[10px] tracking-widest bg-ink text-paper flex justify-between">
              <span>CREW · {1 + joinedMembers.length}</span>
              {mine && joinedMembers.length > 0 && card.roles.length === 0 && <span className="opacity-70">TAP A ROLE TO NAME IT</span>}
            </div>
            <ul>
              <li className="px-3 py-2 border-t border-rule flex items-center gap-3">
                <span className="tag shrink-0">CREATOR</span>
                <Link href={`/u/${card.owner.id}`} className="mono text-[12px] truncate hover:underline">@{card.owner.displayName}</Link>
              </li>
              {joinedMembers.map((j) => (
                <li key={j.userId} className="px-3 py-2 border-t border-rule flex items-center gap-3">
                  {mine && card.roles.length === 0 ? (
                    <input
                      defaultValue={j.role}
                      placeholder="ROLE — e.g. DJ, COOK, GUEST"
                      maxLength={40}
                      onBlur={(ev) => { const v = ev.currentTarget.value; if (v !== j.role) doSetRole(j.userId, v); }}
                      onKeyDown={(ev) => { if (ev.key === "Enter") (ev.currentTarget as HTMLInputElement).blur(); }}
                      className="mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full border border-rule-strong bg-paper w-[180px] focus:outline-none focus:bg-ink focus:text-paper transition-colors"
                    />
                  ) : (
                    <span className="tag shrink-0">{j.role.toUpperCase() || "DABEI"}</span>
                  )}
                  <Link href={`/u/${j.userId}`} className="mono text-[12px] truncate flex-1 hover:underline">@{j.user.displayName}</Link>
                  {mine && (
                    <button onClick={() => doRemoveMember(j.userId)} className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100" aria-label="Remove">✕</button>
                  )}
                </li>
              ))}
            </ul>
          </div>

        <div className="pt-6 flex items-center justify-between gap-3 flex-wrap" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)" }}>
          <Link href="/" className="mono text-[11px] tracking-widest hover:underline">← BACK</Link>
          <ReportButton targetKind="card" targetId={card.id} ownerId={card.ownerId} />
        </div>
      </div>
      </main>

      {editing && draft && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[1200] flex sm:items-center sm:justify-center sm:bg-ink/50 sm:backdrop-blur-sm sm:p-6 animate-fadeIn">
          <div className="bg-paper flex flex-col w-full h-full sm:max-w-[700px] sm:max-h-[90vh] sm:h-auto sm:rounded-2xl sm:border sm:border-rule sm:shadow-lg sm:overflow-hidden">
          <div className="flex items-center justify-between border-b border-rule px-4 sm:px-6 py-3 sm:py-4 shrink-0 safe-top">
            <div className="mono text-[10px] tracking-widest opacity-70">EDIT</div>
            <button onClick={() => setEditing(false)} className="mono text-[11px] tracking-widest hover:underline">CLOSE ✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 max-w-2xl w-full mx-auto space-y-4">
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">TITLE</label>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="input mt-1" />
            </div>
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">DESCRIPTION</label>
              <textarea value={draft.description} rows={4} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input mt-1 resize-none" />
            </div>
            {(
              <>
                <div>
                  <label className="mono text-[10px] tracking-widest opacity-70">PEOPLE</label>
                  <input type="number" min={1} max={99} value={draft.spots} onChange={(e) => setDraft({ ...draft, spots: Number(e.target.value) })} className="input mt-1 tabular-nums" />
                </div>
                <div>
                  <label className="mono text-[10px] tracking-widest opacity-70">PERMISSION</label>
                  <div className="mt-1 flex gap-2">
                    <button onClick={() => setDraft({ ...draft, permission: "public" })} className={`flex-1 px-3 py-2 rounded-full border mono text-[10px] tracking-widest transition-colors ${draft.permission === "public" ? "bg-ink text-paper border-ink" : "bg-paper border-rule-strong"}`}>PUBLIC JOIN</button>
                    <button onClick={() => setDraft({ ...draft, permission: "request" })} className={`flex-1 px-3 py-2 rounded-full border mono text-[10px] tracking-widest transition-colors ${draft.permission === "request" ? "bg-ink text-paper border-ink" : "bg-paper border-rule-strong"}`}>REQUEST</button>
                  </div>
                </div>

                <RolesEditor
                  value={draft.roles}
                  onChange={(roles) => setDraft({ ...draft, roles })}
                  suggestions={roleSuggestions}
                  onSuggest={suggestRoles}
                  suggestBusy={suggestingRoles}
                />
              </>
            )}
          </div>
          <div className="border-t border-rule px-4 sm:px-6 py-3 flex justify-end gap-2 shrink-0" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
            <button onClick={() => setEditing(false)} className="btn ghost" disabled={busy}>Cancel</button>
            <button onClick={saveEdit} className="btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
