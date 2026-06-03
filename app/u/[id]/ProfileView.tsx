"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Header } from "@/components/Header";
import { Constellation } from "@/components/Constellation";
import { FollowButton } from "@/components/FollowButton";
import { fetchProfile, fetchTrackRecord, fetchFollowerCount, isFollowing } from "@/lib/db";
import { useRealtimeCards } from "@/lib/realtime";
import type { Profile, TrackEntry } from "@/lib/types";
import { expiresIn, timeAgo } from "@/lib/time";
import { shareCard } from "@/lib/share";
import { cardColor, isDark } from "@/lib/color";

type Tab = "track" | "carnet";

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
      return { key, label, items: items.slice().sort((a, b) => b.at - a.at) };
    });
}

export function ProfileView({ userId }: { userId: string }) {
  const router = useRouter();
  const { user: currentUser } = useUser();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [track, setTrack] = useState<TrackEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("track");
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // If you land on your own /u/<id>, bounce to the editable /carnet.
  useEffect(() => {
    if (currentUser?.id === userId) router.replace("/carnet");
  }, [currentUser, userId, router]);

  const refresh = useCallback(() => {
    Promise.all([fetchProfile(userId), fetchTrackRecord(userId)])
      .then(([p, t]) => {
        setProfile(p);
        setTrack(t);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [userId]);

  // Follow state: whether I follow them + their follower count.
  const refreshFollow = useCallback(() => {
    fetchFollowerCount(userId).then(setFollowerCount).catch(() => {});
    if (currentUser?.id) {
      isFollowing(currentUser.id, userId).then(setFollowing).catch(() => {});
    } else {
      setFollowing(false);
    }
  }, [userId, currentUser?.id]);

  useEffect(() => {
    refreshFollow();
  }, [refreshFollow]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useRealtimeCards(refresh);

  const counts = useMemo(() => {
    const created = track.filter((t) => t.isCreator).length;
    const joined = track.length - created;
    const rolesPlayed = new Set(
      track.filter((t) => !t.isCreator).map((t) => t.role).filter(Boolean),
    ).size;
    const quartiers = new Set(
      track.map((t) => t.card.location?.label).filter(Boolean),
    ).size;
    const monthsSpan = new Set(
      track.map((t) => {
        const d = new Date(t.at);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }),
    ).size;
    return { created, joined, total: track.length, rolesPlayed, quartiers, monthsSpan };
  }, [track]);

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

  if (!loaded) return <div className="h-[100dvh] bg-paper" />;
  if (!profile) {
    return (
      <div className="app-shell">
        <Header />
        <main className="animate-fadeIn">
          <div className="grid place-items-center min-h-full px-6 text-center py-20">
            <div>
              <div className="editorial font-black text-[40px]">No profile here.</div>
              <p className="mono text-[12px] opacity-70 mt-2">
                This user hasn't posted or joined anything yet.
              </p>
              <Link href="/" className="btn mt-6 inline-block">← Back to Paris</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex flex-col animate-fadeIn">
        <div className="border-b border-rule-strong px-4 sm:px-8 py-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 border border-rule-strong overflow-hidden bg-white">
              {profile.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mono text-[10px] tracking-widest opacity-60">PROFILE</div>
                  <h1 className="editorial font-black text-[34px] sm:text-[56px] leading-[1.05] mt-1 pb-1 truncate">
                    @{profile.displayName}
                  </h1>
                </div>
                <div className="shrink-0 pt-1">
                  <FollowButton
                    targetId={profile.id}
                    following={following}
                    onChanged={refreshFollow}
                  />
                </div>
              </div>
              {profile.bio && (
                <p className="mt-2 text-[14px] leading-[1.4] max-w-xl">{profile.bio}</p>
              )}
              <div className="mono text-[11px] mt-2 opacity-70">
                {counts.total} ENTR{counts.total === 1 ? "Y" : "IES"} · {counts.created} CREATED · {counts.joined} JOINED
                {followerCount > 0 && ` · ${followerCount} FOLLOWER${followerCount === 1 ? "" : "S"}`}
              </div>
              {profile.interests && profile.interests.length > 0 && (
                <div className="mono text-[10px] tracking-widest mt-2 opacity-70 flex flex-wrap gap-1">
                  {profile.interests.map((i) => (
                    <span key={i} className="border border-rule-strong px-1.5 py-0.5">
                      {i.toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
              {profile.socials && Object.values(profile.socials).some(Boolean) && (
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
              className={`px-4 py-3 mono text-[11px] tracking-widest border-r border-rule-strong ${tab === t ? "bg-ink text-paper" : "bg-paper text-ink"}`}
            >
              {t === "track" ? "TRACK RECORD" : t.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {tab === "track" && (
            <div>
              {track.length === 0 ? (
                <div className="px-6 py-20 text-center">
                  <div className="editorial font-black text-[34px]">Nothing yet.</div>
                </div>
              ) : (
                track.map((t) => (
                  <PublicTrackRow key={`${t.card.id}-${t.isCreator ? "c" : "j"}`} entry={t} />
                ))
              )}
            </div>
          )}

          {tab === "carnet" && (
            <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1280px] mx-auto">
              {track.length === 0 ? (
                <div className="px-6 py-20 text-center">
                  <div className="editorial font-black text-[34px]">Empty carnet.</div>
                </div>
              ) : (
                <>
                  <div className="mb-6 sm:mb-10">
                    <p className="editorial font-black text-[32px] sm:text-[44px] leading-[0.96] max-w-3xl">
                      A printable record<br />
                      of every light they stood under.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 sm:gap-10 items-start">
                    <div className="lg:sticky lg:top-4">
                      <div className="border border-rule-strong bg-paper p-5 sm:p-7">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="mono text-[10px] tracking-widest opacity-60">
                            CARNET · @{profile.displayName.toUpperCase()}
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
                        <div className="mt-4 mono text-[10px] tracking-widest opacity-60">
                          CREATOR.PARIS — A LIVING CITY LAYER
                        </div>
                      </div>
                    </div>
                    <div>
                      {monthGroups.map((g) => (
                        <div key={g.key} className="mb-6 last:mb-0">
                          <div className="flex items-baseline justify-between border-b border-rule-strong pb-1.5 mono text-[10px] tracking-widest opacity-70">
                            <span>{g.label}</span>
                            <span>{g.items.length} {g.items.length === 1 ? "ENTRY" : "ENTRIES"}</span>
                          </div>
                          <ul>
                            {g.items.map((e) => (
                              <PublicTrackLine
                                key={`${e.card.id}-${e.isCreator ? "c" : "j"}`}
                                entry={e}
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
    </div>
  );
}

function PublicTrackRow({ entry }: { entry: TrackEntry }) {
  const { card, role, at, isCreator } = entry;
  const color = cardColor(card);
  const dark = isDark(color);
  const isIdea = card.kind === "idea";
  const headlineTag = card.tags?.[0]?.toUpperCase() || (isIdea ? "IDEA" : "THING");
  const now = Date.now();
  const status =
    card.archived || (card.expiresAt != null && card.expiresAt <= now) ? "ARCHIVED" : "ACTIVE";

  const allCrew = [
    { id: card.owner.id, displayName: card.owner.displayName, avatarUrl: card.owner.avatarUrl },
    ...card.joiners.map((j) => ({ id: j.userId, displayName: j.user.displayName, avatarUrl: j.user.avatarUrl })),
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
        >
          <div className={`absolute left-2 top-2 mono text-[9px] tracking-widest px-1.5 py-0.5 max-w-[calc(100%-16px)] truncate ${dark ? "bg-paper text-ink" : "bg-ink text-paper"}`}>
            {headlineTag}
          </div>
          {status === "ACTIVE" ? (
            <div className={`absolute right-2 bottom-2 mono text-[9px] tracking-widest px-1.5 py-0.5 font-medium ${dark ? "bg-paper text-ink" : "bg-ink text-paper"}`}>
              ● ACTIVE
            </div>
          ) : (
            <div className={`absolute right-2 bottom-2 mono text-[9px] tracking-widest px-1.5 py-0.5 border border-dashed bg-transparent ${dark ? "text-paper/70 border-paper/50" : "text-ink/55 border-rule-strong/40"}`}>
              ◌ ARCHIVED
            </div>
          )}
        </Link>
        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-5 min-w-0">
          <div className="mono text-[10px] tracking-widest flex items-center gap-2 opacity-70 flex-wrap">
            <span className={`px-1.5 py-0.5 border border-rule-strong ${isCreator ? "bg-ink text-paper" : "bg-paper text-ink"}`}>
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
              <span>BY @{card.owner.displayName}</span>
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
                <span className="mono text-[10px] tracking-widest opacity-60 hidden sm:inline">CREW</span>
                <div className="flex -space-x-1.5">
                  {visibleCrew.map((m) => (
                    <Link
                      key={m.id}
                      href={`/u/${m.id}`}
                      title={`@${m.displayName}`}
                      className="block w-7 h-7 border border-rule-strong bg-paper overflow-hidden hover:z-10 hover:scale-110 transition relative"
                    >
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
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
          await shareCard(card);
        }}
        className="w-12 sm:w-20 border-l border-rule-strong mono text-[10px] tracking-widest hover:bg-ink hover:text-paper"
        aria-label="Share as image"
      >
        ↗
      </button>
    </div>
  );
}

function PublicTrackLine({ entry }: { entry: TrackEntry }) {
  const { card, role, at, isCreator } = entry;
  const d = new Date(at);
  const dateStr = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const inner = cardColor(card);
  const outer = "#0a0a0a";
  return (
    <li className="border-b border-rule last:border-b-0">
      <Link
        href={`/post/${card.id}`}
        className="grid grid-cols-[44px_22px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 group"
      >
        <span className="mono text-[11px] tabular-nums opacity-60">{dateStr}</span>
        <span className="inline-flex items-center justify-center">
          {isCreator ? (
            <span className="block w-3 h-3 border-2" style={{ borderColor: outer }} />
          ) : (
            <span className="block w-3 h-3" style={{ backgroundColor: inner, outline: `1px solid ${outer}` }} />
          )}
        </span>
        <span className="text-[14px] leading-snug truncate group-hover:underline decoration-2 underline-offset-2">
          {card.title}
          {card.location?.label && <span className="opacity-50"> — {card.location.label}</span>}
        </span>
        <span className="mono text-[10px] tracking-widest opacity-70">
          {isCreator ? "POSTED" : role}
        </span>
      </Link>
    </li>
  );
}
