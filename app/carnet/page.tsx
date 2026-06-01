"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Header } from "@/components/Header";
import { fetchTrackRecord } from "@/lib/db";
import { useRealtimeCards } from "@/lib/realtime";
import type { Profile, TrackEntry } from "@/lib/types";
import { expiresIn, timeAgo } from "@/lib/time";
import { downloadCarnetPoster, exportCarnetPrintable, shareCard } from "@/lib/share";
import { cardColor, isDark } from "@/lib/color";
import { Constellation } from "@/components/Constellation";
import { ProfileEditor } from "@/components/ProfileEditor";

type Tab = "track" | "carnet";
type TrackFilter = "all" | "ideas" | "things";

interface MonthGroup {
  key: string;
  label: string;
  items: TrackEntry[];
}

function groupByMonth(entries: TrackEntry[]): MonthGroup[] {
  const map = new Map<string, TrackEntry[]>();
  for (const e of entries) {
    const d = new Date(e.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1)
        .toLocaleDateString("en-GB", { month: "long", year: "numeric" })
        .toUpperCase();
      return {
        key,
        label,
        items: items.slice().sort((a, b) => b.at - a.at),
      };
    });
}

// API returns snake_case rows from Supabase; light client-side mapping.
function mapProfileRow(p: Record<string, unknown>): Profile {
  return {
    id: String(p.id ?? ""),
    phone: (p.phone as string | null) ?? null,
    displayName: String(p.display_name ?? ""),
    avatarUrl: (p.avatar_url as string | null) ?? null,
    socials: (p.socials as Profile["socials"]) ?? null,
    interests: (p.interests as string[] | null) ?? null,
    bio: (p.bio as string | null) ?? null,
    createdAt: p.created_at ? new Date(String(p.created_at)).getTime() : 0,
    usernameChangedAt: p.username_changed_at
      ? new Date(String(p.username_changed_at)).getTime()
      : null,
  };
}

export default function CarnetPage() {
  const { user, isLoaded } = useUser();
  const [tab, setTab] = useState<Tab>("track");
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");
  const [track, setTrack] = useState<TrackEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  const refresh = useCallback(() => {
    if (!user) return;
    fetchTrackRecord(user.id).then(setTrack).catch(() => setTrack([]));
    fetch("/api/profile/me")
      .then((r) => r.json())
      .then((j) => j?.profile && setProfile(mapProfileRow(j.profile)))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // make sure the user has a profile in supabase
    fetch("/api/profile/me", { method: "POST" }).catch(() => {});
    refresh();
  }, [user, refresh]);
  useRealtimeCards(refresh);

  // Only cards with a real location can be plotted / postered. Ideas without
  // a loose pin are simply omitted from the geographic surfaces.
  const mapCards = useMemo(
    () => track.map((t) => t.card).filter((c) => !!c.location),
    [track],
  );
  const counts = useMemo(() => {
    const created = track.filter((t) => t.isCreator).length;
    const joined = track.length - created;
    const rolesPlayed = new Set(
      track.filter((t) => !t.isCreator).map((t) => t.role).filter(Boolean),
    ).size;
    const quartiers = new Set(
      track.map((t) => t.card.location?.label).filter(Boolean),
    ).size;
    const monthsSpan = (() => {
      if (track.length === 0) return 0;
      const months = new Set(track.map((t) => {
        const d = new Date(t.at);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }));
      return months.size;
    })();
    return { created, joined, total: track.length, rolesPlayed, quartiers, monthsSpan };
  }, [track]);

  // Track filter: lets the user isolate just their ideas (the latent layer)
  // or just their things (the concrete one) from a mixed track record.
  const filterCounts = useMemo(() => {
    const ideas = track.filter((t) => t.card.kind === "idea").length;
    return { all: track.length, ideas, things: track.length - ideas };
  }, [track]);
  const filteredTrack = useMemo(() => {
    if (trackFilter === "all") return track;
    const want: "idea" | "thing" = trackFilter === "ideas" ? "idea" : "thing";
    return track.filter((t) => t.card.kind === want);
  }, [track, trackFilter]);

  // Username can change 1×/week. If we're still inside the cooldown, surface
  // when the next change becomes possible (mirrors the rule in ProfileEditor).
  const usernameNextChange = useMemo(() => {
    const changed = profile?.usernameChangedAt;
    if (!changed) return null;
    const next = changed + 7 * 24 * 60 * 60 * 1000;
    if (next <= Date.now()) return null;
    return new Date(next)
      .toLocaleString("en-GB", {
        weekday: "short", day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit",
      })
      .toUpperCase();
  }, [profile?.usernameChangedAt]);

  const monthGroups = useMemo(() => groupByMonth(track), [track]);
  const range = useMemo(() => {
    if (track.length === 0) return "";
    const ats = track.map((t) => t.at);
    const first = new Date(Math.min(...ats));
    const last = new Date(Math.max(...ats));
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }).toUpperCase();
    return `${fmt(first)} → ${fmt(last)}`;
  }, [track]);

  if (!isLoaded) return <div className="h-[100dvh] bg-paper" />;
  if (!user) {
    return (
      <div className="app-shell">
        <Header />
        <main className="animate-fadeIn">
          <div className="grid place-items-center min-h-full px-6 text-center py-20">
            <div>
              <div className="editorial font-black text-[40px]">No carnet yet.</div>
              <Link href="/" className="btn mt-6 inline-block">← Go set up</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const displayName =
    profile?.displayName ||
    user.username ||
    [user.firstName, user.lastName].filter(Boolean).join("").toLowerCase().trim() ||
    `paris-${user.id.slice(-4)}`;

  return (
    <div className="app-shell">
      <Header />
      <main className="flex flex-col animate-fadeIn">

      <div className="border-b border-rule-strong px-4 sm:px-8 py-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 border border-rule-strong overflow-hidden bg-white">
            {user.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="mono text-[10px] tracking-widest opacity-60 flex items-center gap-3">
              <span>PROFILE</span>
              <button
                onClick={() => setEditingProfile(true)}
                className="mono text-[10px] tracking-widest border border-rule-strong px-2 py-0.5 hover:bg-ink hover:text-paper"
              >
                ✎ EDIT
              </button>
            </div>
            <h1 className="editorial font-black text-[34px] sm:text-[56px] leading-[1.05] mt-1 pb-1 truncate">
              @{displayName}
            </h1>
            {profile?.bio && (
              <p className="mt-2 text-[14px] leading-[1.4] max-w-xl">{profile.bio}</p>
            )}
            <div className="mono text-[11px] mt-2 opacity-70">
              {counts.total} ENTR{counts.total === 1 ? "Y" : "IES"} · {counts.created} CREATED · {counts.joined} JOINED
            </div>
            {usernameNextChange && (
              <div className="mono text-[10px] tracking-widest mt-1.5 opacity-50">
                ↺ USERNAME CHANGEABLE AGAIN · {usernameNextChange}
              </div>
            )}
            {profile?.interests && profile.interests.length > 0 && (
              <div className="mono text-[10px] tracking-widest mt-2 opacity-70 flex flex-wrap gap-1">
                {profile.interests.map((i) => (
                  <span key={i} className="border border-rule-strong px-1.5 py-0.5">
                    {i.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
            {profile?.socials && Object.values(profile.socials).some(Boolean) && (
              <div className="mono text-[10px] tracking-widest mt-2 opacity-70 flex flex-wrap gap-3">
                {profile.socials.instagram && <span>@{profile.socials.instagram} · IG</span>}
                {profile.socials.telegram && <span>@{profile.socials.telegram} · TG</span>}
                {profile.socials.whatsapp && <span>+{profile.socials.whatsapp} · WA</span>}
                {profile.socials.site && (
                  <a href={profile.socials.site} target="_blank" rel="noreferrer" className="underline">
                    ↗ {profile.socials.site.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-rule-strong px-4 sm:px-8 flex shrink-0">
        {(["track", "carnet"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`cp-lead-col px-4 py-3 mono text-[11px] tracking-widest border-r border-rule-strong text-left ${tab === t ? "bg-ink text-paper" : "bg-paper text-ink"}`}
          >
            {t === "track" ? "TRACK RECORD" : t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "track" && (
          <div>
            {track.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <div className="editorial font-black text-[34px]">Your track is empty.</div>
                <p className="mono text-[12px] opacity-70 mt-2">
                  Post a card — or join someone else's. Either way, it lands here.
                </p>
                <Link href="/" className="btn inline-block mt-6">＋ POST ONE THING</Link>
              </div>
            ) : (
              <>
                <div className="px-4 sm:px-8 py-3 border-b border-rule flex flex-wrap gap-2 items-center">
                  {(["all", "ideas", "things"] as TrackFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setTrackFilter(f)}
                      className={`mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border transition-colors ${trackFilter === f ? "bg-ink text-paper border-ink" : "bg-paper text-ink border-rule-strong hover:bg-ink hover:text-paper"}`}
                    >
                      {f.toUpperCase()} · {filterCounts[f]}
                    </button>
                  ))}
                </div>
                {filteredTrack.length === 0 ? (
                  <div className="px-6 py-16 text-center mono text-[11px] tracking-widest opacity-60">
                    NO {trackFilter.toUpperCase()} YET.
                  </div>
                ) : (
                  filteredTrack.map((t) => (
                    <TrackRow
                      key={`${t.card.id}-${t.isCreator ? "c" : "j"}`}
                      entry={t}
                      avatarUrl={user.imageUrl}
                    />
                  ))
                )}
              </>
            )}
          </div>
        )}

        {tab === "carnet" && (
          <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1280px] mx-auto">
            {track.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <div className="editorial font-black text-[34px]">Nothing to print yet.</div>
                <p className="mono text-[12px] opacity-70 mt-2">
                  Once you have a few cards, your carnet starts taking shape here.
                </p>
                <Link href="/" className="btn inline-block mt-6">＋ POST ONE THING</Link>
              </div>
            ) : (
              <>
                <div className="mb-6 sm:mb-10 flex flex-wrap items-end justify-between gap-4">
                  <p className="editorial font-black text-[32px] sm:text-[44px] leading-[0.96] max-w-3xl">
                    A printable record<br />
                    of every light you stood under.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        setExporting("png");
                        try {
                          await downloadCarnetPoster(
                            mapCards.map((c) => ({
                              lat: c.location!.lat,
                              lng: c.location!.lng,
                              label: c.location!.label,
                              title: c.title,
                              createdAt: c.createdAt,
                              color: cardColor(c),
                              outerColor: "#0a0a0a",
                            })),
                            displayName,
                          );
                        } finally {
                          setExporting(null);
                        }
                      }}
                      disabled={exporting !== null}
                      className="btn"
                    >
                      {exporting === "png" ? "RENDERING…" : "↓ PNG POSTER"}
                    </button>
                    <button
                      onClick={() => exportCarnetPrintable(mapCards, displayName)}
                      className="btn ghost"
                      disabled={exporting !== null}
                    >
                      ↓ PDF
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 sm:gap-10 items-start">
                  {/* LEFT — poster card */}
                  <div className="lg:sticky lg:top-4">
                    <div className="border border-rule-strong bg-paper p-5 sm:p-7">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="mono text-[10px] tracking-widest opacity-60">
                          CARNET · @{displayName.toUpperCase()}
                        </div>
                        <div className="mono text-[10px] tracking-widest opacity-60 text-right">
                          {range}
                        </div>
                      </div>

                      <h2 className="editorial font-black text-[28px] sm:text-[36px] leading-[0.96] mt-4">
                        {counts.monthsSpan} {counts.monthsSpan === 1 ? "month" : "months"},<br />
                        {counts.total} {counts.total === 1 ? "entry" : "entries"},<br />
                        {counts.quartiers} {counts.quartiers === 1 ? "quartier" : "quartiers"}.
                      </h2>

                      <div className="mt-3 mono text-[10px] tracking-widest opacity-60 border-t border-rule pt-3">
                        {counts.total} CARDS · {counts.created} POSTED · {counts.joined} JOINED · {counts.rolesPlayed} ROLES PLAYED
                      </div>

                      <div className="mt-5">
                        <Constellation entries={track} />
                      </div>

                      <div className="mt-4 mono text-[10px] tracking-widest opacity-60 flex items-center justify-between">
                        <span>CREATOR.PARIS — A LIVING CITY LAYER</span>
                        <span>ONE THING, THIS WEEK.</span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT — chronological table grouped by month */}
                  <div>
                    {monthGroups.map((g) => (
                      <div key={g.key} className="mb-6 last:mb-0">
                        <div className="flex items-baseline justify-between border-b border-rule-strong pb-1.5 mono text-[10px] tracking-widest opacity-70">
                          <span>{g.label}</span>
                          <span>
                            {g.items.length} {g.items.length === 1 ? "ENTRY" : "ENTRIES"}
                          </span>
                        </div>
                        <ul>
                          {g.items.map((e) => (
                            <TrackLine
                              key={`${e.card.id}-${e.isCreator ? "c" : "j"}`}
                              entry={e}
                              avatarUrl={user.imageUrl}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
      </main>

      {editingProfile && profile && (
        <ProfileEditor
          profile={profile}
          onClose={() => setEditingProfile(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

/** Compact one-line track entry — editorial chronological row. */
function TrackLine({
  entry,
  avatarUrl,
}: {
  entry: TrackEntry;
  avatarUrl?: string;
}) {
  const { card, role, at, isCreator } = entry;
  const [busy, setBusy] = useState(false);
  const d = new Date(at);
  const dateStr = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const inner = cardColor(card);
  const outer = "#0a0a0a";

  return (
    <li className="border-b border-rule last:border-b-0">
      <div className="grid grid-cols-[44px_22px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 group">
        <Link href={`/post/${card.id}`} className="contents">
          <span className="mono text-[11px] tabular-nums opacity-60">
            {dateStr}
          </span>
          <span className="inline-flex items-center justify-center">
            {isCreator ? (
              <span
                className="block w-3 h-3 border-2"
                style={{ borderColor: outer }}
                aria-label="Posted"
              />
            ) : (
              <span
                className="block w-3 h-3"
                style={{ backgroundColor: inner, outline: `1px solid ${outer}` }}
                aria-label="Joined"
              />
            )}
          </span>
          <span className="text-[14px] leading-snug truncate group-hover:underline decoration-2 underline-offset-2">
            {card.title}
            {card.location?.label && <span className="opacity-50"> — {card.location.label}</span>}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="mono text-[10px] tracking-widest opacity-70">
            {isCreator ? "POSTED" : role}
          </span>
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await shareCard(card);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="mono text-[10px] tracking-widest px-1.5 py-0.5 border border-rule-strong opacity-0 group-hover:opacity-100 hover:bg-ink hover:text-paper transition"
            aria-label="Share as image"
          >
            {busy ? "…" : "↗"}
          </button>
        </div>
      </div>
    </li>
  );
}

/** Detail track card with full meta + clickable crew avatars. */
function TrackRow({
  entry,
  avatarUrl,
}: {
  entry: TrackEntry;
  avatarUrl?: string;
}) {
  const { card, role, at, isCreator } = entry;
  const color = cardColor(card);
  const dark = isDark(color);
  const isIdea = card.kind === "idea";
  const headlineTag = card.tags?.[0]?.toUpperCase() || (isIdea ? "IDEA" : "THING");
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const status =
    card.archived || (card.expiresAt != null && card.expiresAt <= now) ? "ARCHIVED" : "ACTIVE";

  // Crew = creator + joiners. De-duped, max 6 visible.
  const allCrew = [
    { id: card.owner.id, displayName: card.owner.displayName, avatarUrl: card.owner.avatarUrl, isCreator: true as const },
    ...card.joiners.map((j) => ({
      id: j.userId,
      displayName: j.user.displayName,
      avatarUrl: j.user.avatarUrl,
      isCreator: false as const,
    })),
  ];
  const visibleCrew = allCrew.slice(0, 6);
  const restCrew = allCrew.length - visibleCrew.length;

  return (
    <div className="border-b border-rule-strong flex items-stretch pl-4 sm:pl-8">
      <div className="flex-1 flex items-stretch min-w-0">
        <Link
          href={`/post/${card.id}`}
          className="cp-lead-col shrink-0 relative block"
          style={{ backgroundColor: color }}
          aria-label="Open card"
        >
          <div
            className={`absolute left-2 top-2 mono text-[9px] tracking-widest px-1.5 py-0.5 max-w-[calc(100%-16px)] truncate ${dark ? "bg-paper text-ink" : "bg-ink text-paper"}`}
          >
            {headlineTag}
          </div>
          {status === "ACTIVE" ? (
            <div
              className={`absolute right-2 bottom-2 mono text-[9px] tracking-widest px-1.5 py-0.5 font-medium ${dark ? "bg-paper text-ink" : "bg-ink text-paper"}`}
            >
              ● ACTIVE
            </div>
          ) : (
            <div
              className={`absolute right-2 bottom-2 mono text-[9px] tracking-widest px-1.5 py-0.5 border border-dashed bg-transparent ${dark ? "text-paper/70 border-paper/50" : "text-ink/55 border-rule-strong/40"}`}
            >
              ◌ ARCHIVED
            </div>
          )}
        </Link>

        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-5 min-w-0">
          <div className="mono text-[10px] tracking-widest flex items-center gap-2 opacity-70 flex-wrap">
            <span
              className={`px-1.5 py-0.5 border border-rule-strong ${isCreator ? "bg-ink text-paper" : "bg-paper text-ink"}`}
            >
              {isCreator ? "CREATOR" : role.toUpperCase() || "JOINER"}
            </span>
            <span>{(card.location?.label || (isIdea ? "IDEA" : "PARIS")).toUpperCase()}</span>
            <span className="ml-auto">{timeAgo(at)}</span>
          </div>

          <Link href={`/post/${card.id}`} className="block group">
            <h2 className="editorial font-black text-[22px] sm:text-[28px] mt-2 leading-[0.95] group-hover:underline decoration-2 underline-offset-4">
              {card.title}
            </h2>
          </Link>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="mono text-[11px] opacity-70 flex items-center gap-2 flex-wrap">
              <Link href={`/u/${card.owner.id}`} className="hover:underline">
                {isCreator ? "BY YOU" : `BY @${card.owner.displayName}`}
              </Link>
              <span>·</span>
              {isIdea ? (
                <span>{card.signals.length} RESONATING</span>
              ) : (
                <>
                  <span>{card.joiners.length}/{card.spots ?? "—"} PEOPLE</span>
                  <span>·</span>
                  <span>{card.expiresAt ? expiresIn(card.expiresAt).toUpperCase() : "OPEN"}</span>
                </>
              )}
            </div>
            {allCrew.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="mono text-[10px] tracking-widest opacity-60 hidden sm:inline">
                  CREW
                </span>
                <div className="flex -space-x-1.5">
                  {visibleCrew.map((m) => (
                    <Link
                      key={m.id}
                      href={`/u/${m.id}`}
                      title={`@${m.displayName}${m.isCreator ? " · creator" : ""}`}
                      className="block w-7 h-7 border border-rule-strong bg-paper overflow-hidden hover:z-10 hover:scale-110 transition relative"
                    >
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="mono text-[9px] flex items-center justify-center w-full h-full opacity-60">
                          {m.displayName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </Link>
                  ))}
                  {restCrew > 0 && (
                    <span className="block w-7 h-7 border border-rule-strong bg-paper mono text-[9px] tracking-widest flex items-center justify-center">
                      +{restCrew}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await shareCard(card);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="w-12 sm:w-20 border-l border-rule-strong mono text-[10px] tracking-widest hover:bg-ink hover:text-paper"
        aria-label="Share as image"
      >
        {busy ? "…" : "↗"}
      </button>
    </div>
  );
}
