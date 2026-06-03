"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SignUpButton, useUser } from "@clerk/nextjs";
import { Header } from "@/components/Header";
import { ParisMap } from "@/components/ParisMap";
import { ResonanceMeter } from "@/components/ResonanceMeter";
import { SignalButton } from "@/components/SignalButton";
import { TransformPanel } from "@/components/TransformPanel";
import { ReportButton } from "@/components/ReportButton";
import { ModuleArea } from "@/components/modules/ModuleArea";
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
  const [justPosted, setJustPosted] = useState<null | "idea" | "thing">(null);
  useEffect(() => {
    const v = searchParams.get("new");
    if (v) {
      setJustPosted(v === "idea" ? "idea" : "thing");
      window.history.replaceState(null, "", `/post/${id}`);
      const t = window.setTimeout(() => setJustPosted(null), 5000);
      return () => window.clearTimeout(t);
    }
  }, [searchParams, id]);
  const [sharing, setSharing] = useState(false);
  const [shareHint, setShareHint] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    description: string;
    spots: number;
    permission: "public" | "request";
  } | null>(null);
  const [busy, setBusy] = useState(false);


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

  const isIdea = card.kind === "idea";
  const color = cardColor(card);
  const dark = isDark(color);
  const headlineTag = card.tags?.[0]?.toUpperCase() || (isIdea ? "IDEA" : "THING");
  const mine = !!user && user.id === card.ownerId;
  const joined = !!user && card.joiners.some((j) => j.userId === user.id);
  const requested = !!user && card.requests.some((r) => r.userId === user.id);
  const signalled = !!user && card.signals.some((s) => s.userId === user.id);
  const full = card.spots != null && card.joiners.length >= card.spots;
  const signalCount = card.signals.length;

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
    await fetch(`/api/cards/${card.id}/requests/${uid}`, { method: "POST" });
    refresh();
  }
  async function doDecline(uid: string) {
    if (!card) return;
    await fetch(`/api/cards/${card.id}/requests/${uid}`, { method: "DELETE" });
    refresh();
  }
  async function doRemoveJoiner(uid: string) {
    if (!card) return;
    if (!confirm("Remove this joiner from the crew?")) return;
    await fetch(`/api/cards/${card.id}/joiners/${uid}`, { method: "DELETE" });
    refresh();
  }
  async function doSetRole(uid: string, role: string) {
    if (!card) return;
    await fetch(`/api/cards/${card.id}/joiners/${uid}`, {
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
  async function removeCard() {
    if (!card) return;
    if (!confirm(isIdea ? "Delete this idea?" : "Delete this thing?")) return;
    await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
    router.push("/");
  }

  // Banner copy depends on what just happened.
  const bannerText =
    justPosted === "idea"
      ? "✓ IDEA IN THE FIELD · SHARE IT TO GATHER RESONANCE"
      : justPosted === "thing"
        ? "✓ IT'S REAL NOW · LIVE ON THE MAP"
        : "";

  return (
    <div className="app-shell">
      <Header />
      {justPosted && (
        <div className="shrink-0 bg-ink text-paper mono text-[11px] tracking-widest px-4 sm:px-8 py-2.5 flex items-center gap-2 animate-fadeIn">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-paper animate-twinkle" />
          {bannerText}
          <button
            onClick={() => setJustPosted(null)}
            className="ml-auto opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <main className="animate-fadeIn">

      {/* ===================== HERO ===================== */}
      {isIdea ? (
        // IDEA hero — quiet paper, dashed frame, the idea mark. Latent, alive.
        <div className="relative border-b border-rule-strong cp-idea-frame">
          <div className="cp-idea-edge px-4 sm:px-8 py-8 sm:py-14 max-w-4xl mx-auto">
            <div className="mono text-[10px] tracking-widest flex items-center gap-2 opacity-80">
              <span className="cp-idea-mark" /> IDEA
              {card.location?.label && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{card.location.label.toUpperCase()}</span>
                </>
              )}
              <span className="opacity-40">·</span>
              <span>OPEN UNTIL IT HAPPENS</span>
            </div>
            <h1 className="editorial font-black text-[34px] sm:text-[68px] mt-3 leading-[0.95] max-w-[22ch]">
              {card.title}
            </h1>
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <ResonanceMeter count={signalCount} capacity={10} />
              <span className="mono text-[11px] tracking-widest tabular-nums">
                {signalCount === 0
                  ? "NO SIGNALS YET — BE THE FIRST"
                  : `${signalCount} ${signalCount === 1 ? "PERSON WANTS" : "PEOPLE WANT"} THIS REAL`}
              </span>
            </div>
          </div>
        </div>
      ) : (
        // THING hero — the Paris-map tinted with the card's color.
        // Substrate is paper, not the card color: otherwise the card color
        // flashes solid for a moment before the tiles arrive. The map
        // wrapper also carries a paper bg so the wrapper paints the same
        // substrate the tiles will sit on, eliminating the flicker
        // entirely. The color overlay runs at opacity 0.78 over the map.
        // No-location fallback paints the card color as a solid block.
        <div className="relative h-[36vh] sm:h-[44vh] border-b border-rule overflow-hidden bg-paper">
          {card.location ? (
            <>
              <div className="absolute inset-0 pointer-events-none bg-paper">
                <ParisMap cards={[card]} highlightId={card.id} focusedCard={card} />
              </div>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: color,
                  opacity: 0.78,
                }}
                aria-hidden
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: color }}
              aria-hidden
            />
          )}
        </div>
      )}

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-6 max-w-4xl w-full mx-auto space-y-6">
        {/* THING title — sits below the tinted map, editorial size on paper. */}
        {!isIdea && (
          <div>
            <div className="mono text-[10px] tracking-widest opacity-80">
              {headlineTag}
            </div>
            <h1 className="editorial font-black text-[42px] sm:text-[88px] leading-[0.95] max-w-[20ch] mt-2">
              {card.title}
            </h1>
          </div>
        )}

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
            {isIdea ? (
              <span className="tag flex items-center gap-1.5"><span className="cp-idea-mark" /> IDEA</span>
            ) : (
              <>
                <span className="tag">{card.permission === "request" ? "REQUEST" : "PUBLIC"}</span>
                <span className="tabular-nums">{card.joiners.length}/{card.spots ?? "—"} PEOPLE</span>
              </>
            )}
          </div>
        </div>

        {/* Fork stamp — immutable credit when this thing is a fork of someone's idea.
            Snapshot survives the original idea's deletion (then we hide the link). */}
        {!isIdea && (card.forkedFromCardId || card.forkedFromTitle) && (
          <div className="border border-rule-strong rounded-2xl px-4 py-3 cp-idea-frame">
            <div className="mono text-[10px] tracking-widest opacity-70 mb-1">
              ↩ FORKED FROM AN IDEA
            </div>
            {card.forkedFromCardId && card.forkedFromOwner ? (
              <Link
                href={`/post/${card.forkedFromCardId}`}
                className="mono text-[11px] hover:underline"
              >
                @{card.forkedFromOwner.displayName} ·{" "}
                <span className="italic">&ldquo;{card.forkedFromTitle}&rdquo;</span>
              </Link>
            ) : (
              <span className="mono text-[11px] opacity-80">
                {card.forkedFromOwner ? `@${card.forkedFromOwner.displayName} · ` : ""}
                <span className="italic">&ldquo;{card.forkedFromTitle || "—"}&rdquo;</span>
                <span className="opacity-50 ml-2">(idea deleted)</span>
              </span>
            )}
          </div>
        )}

        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.tags.map((t) => (
              <span key={t} className="mono text-[10px] tracking-widest rounded-full border border-rule-strong text-ink-soft px-2.5 py-1">
                #{t.toUpperCase()}
              </span>
            ))}
          </div>
        )}

        {/* MODULE area (thing-only) — the typed sub-surface the AI proposes
            and the owner curates. Exactly one module per thing. */}
        {!isIdea && (
          <ModuleArea card={card} mine={mine} onChanged={refresh} />
        )}

        {card.description && (
          <p className="text-[18px] leading-[1.5] whitespace-pre-wrap max-w-2xl">
            {card.description}
          </p>
        )}

        {/* THING-only: starts/where tiles + map */}
        {!isIdea && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[14px]">
              {/* Time — clock glyph + the moment, nothing else. */}
              <div className="panel p-4 flex items-center justify-center gap-2.5 text-center">
                <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" strokeLinecap="round" />
                </svg>
                <div className="leading-snug">
                  {card.expiresAt ? fullStartLabel(card.expiresAt) : "—"}
                  {card.endsAt && (
                    <span className="opacity-60"> – {parisClockLabel(card.endsAt)}</span>
                  )}
                </div>
              </div>
              {/* Place — pin glyph + label + open-in-maps. */}
              <div className="panel p-4 flex items-center justify-center gap-2.5 text-center">
                <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11Z" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <div className="min-w-0 leading-snug">
                  <div className="truncate">{card.location?.label || "—"}</div>
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

        {/* IDEA-only: optional loose place line + mini-map if pinned */}
        {isIdea && card.location && (
          <div className="rounded-2xl overflow-hidden border border-rule shadow-sm h-56">
            <ParisMap cards={[card]} highlightId={card.id} focusedCard={card} />
          </div>
        )}

        {card.externalUrl && (
          <a
            href={card.externalUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 mono text-[11px] tracking-widest rounded-full border border-rule-strong px-3.5 py-2 hover:bg-ink hover:text-paper transition-colors self-start"
          >
            ↗ {card.externalUrl.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
          </a>
        )}

        {/* ===================== ACTIONS ===================== */}
        {isIdea ? (
          <div className="space-y-4">
            {/* Non-owner: signal resonance. Sign-in happens at the tap. */}
            {!mine && !transforming && (
              <div className="cp-idea-frame border border-rule-strong rounded-2xl p-5">
                <div className="mono text-[11px] tracking-widest opacity-70 mb-3">
                  WOULD YOU WANT THIS TO EXIST?
                </div>
                <SignalButton cardId={card.id} signalled={signalled} onChanged={refresh} full />
                <p className="mono text-[10px] opacity-60 mt-3 leading-relaxed">
                  A signal is intent, not a like. If this becomes real, you&rsquo;re
                  invited as part of the first crew.
                </p>
              </div>
            )}

            {/* Non-owner, signed in: fork the idea into your own thing.
                The original idea stays where it is — anyone else can fork
                it too. The new thing carries a permanent credit to it. */}
            {!mine && user && !transforming && (
              <div className="cp-idea-frame border border-rule-strong rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="mono text-[11px] tracking-widest">READY TO MAKE THIS REAL?</div>
                  <div className="mono text-[10px] opacity-60 mt-1">
                    Fork @{card.owner.displayName}&rsquo;s idea into your own
                    thing. They{signalCount > 0
                      ? ` and ${signalCount} signal${signalCount === 1 ? "" : "s"}`
                      : ""} land in your invited crew.
                  </div>
                </div>
                <button
                  onClick={() => setTransforming(true)}
                  className="btn"
                >
                  FORK →
                </button>
              </div>
            )}

            {/* Owner: transform into a thing (in-place flip). */}
            {mine && !transforming && (
              <div className="cp-idea-frame border border-rule-strong rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="mono text-[11px] tracking-widest">READY TO MAKE IT REAL?</div>
                  <div className="mono text-[10px] opacity-60 mt-1">
                    {signalCount > 0
                      ? `${signalCount} ${signalCount === 1 ? "person comes" : "people come"} with you as the first crew.`
                      : "Add a time + place and it becomes joinable."}
                  </div>
                </div>
                <button
                  onClick={() => setTransforming(true)}
                  className={`btn ${signalCount > 0 ? "cp-ready" : ""}`}
                >
                  MAKE IT REAL →
                </button>
              </div>
            )}

            {transforming && (
              <TransformPanel card={card} onCancel={() => setTransforming(false)} />
            )}

            {mine && !transforming && (
              <div className="flex flex-wrap gap-2">
                <button onClick={startEdit} className="btn ghost">EDIT</button>
                <button onClick={removeCard} className="btn ghost">DELETE</button>
                <div className="ml-auto flex items-center gap-2">
                  {shareHint && <span className="mono text-[10px] tracking-widest opacity-70 animate-fadeIn">{shareHint}</span>}
                  <button onClick={onShare} className="btn ghost" disabled={sharing}>{sharing ? "SHARING…" : "↗ SHARE"}</button>
                </div>
              </div>
            )}
            {!mine && (
              <div className="flex items-center gap-2">
                <div className="ml-auto flex items-center gap-2">
                  {shareHint && <span className="mono text-[10px] tracking-widest opacity-70 animate-fadeIn">{shareHint}</span>}
                  <button onClick={onShare} className="btn ghost" disabled={sharing}>{sharing ? "SHARING…" : "↗ SHARE"}</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // THING actions — join / leave / owner edit (existing behavior).
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

        {/* ===================== SIGNALERS (idea) ===================== */}
        {isIdea && signalCount > 0 && (
          <div className="border border-rule rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 mono text-[10px] tracking-widest bg-ink text-paper flex justify-between">
              <span>RESONATING · {signalCount}</span>
              {mine && <span className="opacity-70">YOUR FUTURE CREW</span>}
            </div>
            <ul>
              {card.signals.map((s) => (
                <li key={s.userId} className="px-3 py-2 border-t border-rule flex items-center gap-3">
                  <span className="cp-idea-mark" />
                  <Link href={`/u/${s.userId}`} className="mono text-[12px] truncate hover:underline">
                    @{s.user.displayName}
                  </Link>
                  <span className="ml-auto mono text-[10px] opacity-50">{timeAgo(s.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ===================== THING: pending requests + crew ===================== */}
        {!isIdea && mine && card.requests.length > 0 && (
          <div className="border border-rule rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 mono text-[10px] tracking-widest bg-ink text-paper">
              PENDING REQUESTS · {card.requests.length}
            </div>
            <ul>
              {card.requests.map((r) => (
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

        {!isIdea && (
          <div className="border border-rule rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 mono text-[10px] tracking-widest bg-ink text-paper flex justify-between">
              <span>CREW · {1 + card.joiners.length}</span>
              {mine && card.joiners.length > 0 && <span className="opacity-70">TAP A ROLE TO NAME IT</span>}
            </div>
            <ul>
              <li className="px-3 py-2 border-t border-rule flex items-center gap-3">
                <span className="tag shrink-0">CREATOR</span>
                <Link href={`/u/${card.owner.id}`} className="mono text-[12px] truncate hover:underline">@{card.owner.displayName}</Link>
              </li>
              {card.joiners.map((j) => (
                <li key={j.userId} className="px-3 py-2 border-t border-rule flex items-center gap-3">
                  {mine ? (
                    <input
                      defaultValue={j.role}
                      placeholder="ROLE — e.g. DJ, COOK, GUEST"
                      maxLength={40}
                      onBlur={(ev) => { const v = ev.currentTarget.value; if (v !== j.role) doSetRole(j.userId, v); }}
                      onKeyDown={(ev) => { if (ev.key === "Enter") (ev.currentTarget as HTMLInputElement).blur(); }}
                      className="mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full border border-rule-strong bg-paper w-[180px] focus:outline-none focus:bg-ink focus:text-paper transition-colors"
                    />
                  ) : (
                    <span className="tag shrink-0">{j.role.toUpperCase() || "JOINER"}</span>
                  )}
                  <Link href={`/u/${j.userId}`} className="mono text-[12px] truncate flex-1 hover:underline">@{j.user.displayName}</Link>
                  {mine && (
                    <button onClick={() => doRemoveJoiner(j.userId)} className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100" aria-label="Remove">✕</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-6 flex items-center justify-between gap-3 flex-wrap" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)" }}>
          <Link href="/" className="mono text-[11px] tracking-widest hover:underline">← BACK TO PARIS</Link>
          <ReportButton targetKind="card" targetId={card.id} ownerId={card.ownerId} />
        </div>
      </div>
      </main>

      {editing && draft && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[1200] flex sm:items-center sm:justify-center sm:bg-ink/50 sm:backdrop-blur-sm sm:p-6 animate-fadeIn">
          <div className="bg-paper flex flex-col w-full h-full sm:max-w-[700px] sm:max-h-[90vh] sm:h-auto sm:rounded-2xl sm:border sm:border-rule sm:shadow-lg sm:overflow-hidden">
          <div className="flex items-center justify-between border-b border-rule px-4 sm:px-6 py-3 sm:py-4 shrink-0 safe-top">
            <div className="mono text-[10px] tracking-widest opacity-70">{isIdea ? "EDIT · IDEA" : "EDIT · THING"}</div>
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
            {!isIdea && (
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
