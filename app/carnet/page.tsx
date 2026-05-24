"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Header } from "@/components/Header";
import { ParisMap } from "@/components/ParisMap";
import { fetchTrackRecord } from "@/lib/db";
import { useRealtimeCards } from "@/lib/realtime";
import type { TrackEntry } from "@/lib/types";
import { expiresIn, parisHourOf, timeAgo } from "@/lib/time";
import { downloadCarnetPoster, exportCarnetPrintable, shareCard } from "@/lib/share";
import { ACTIVITY_LABEL, computeVibe } from "@/lib/vibe";

type Tab = "track" | "map" | "export";

export default function CarnetPage() {
  const { user, isLoaded } = useUser();
  const [tab, setTab] = useState<Tab>("track");
  const [track, setTrack] = useState<TrackEntry[]>([]);

  const refresh = useCallback(() => {
    if (!user) return;
    fetchTrackRecord(user.id).then(setTrack).catch(() => setTrack([]));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // make sure the user has a profile in supabase
    fetch("/api/profile/me", { method: "POST" }).catch(() => {});
    refresh();
  }, [user, refresh]);
  useRealtimeCards(refresh);

  const mapCards = useMemo(() => track.map((t) => t.card), [track]);
  const counts = useMemo(() => {
    const created = track.filter((t) => t.isCreator).length;
    const joined = track.length - created;
    return { created, joined, total: track.length };
  }, [track]);

  if (!isLoaded) return <div className="min-h-screen bg-paper" />;
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div>
            <div className="editorial font-black text-[40px]">No carnet yet.</div>
            <Link href="/" className="btn mt-6 inline-block">← Go set up</Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    `Paris-${user.id.slice(-4)}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="border-b border-ink px-4 sm:px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 border border-ink overflow-hidden bg-white">
            {user.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="mono text-[10px] tracking-widest opacity-60">CARNET</div>
            <h1 className="editorial font-black text-[34px] sm:text-[56px] leading-none mt-1 truncate">
              {displayName}
            </h1>
            <div className="mono text-[11px] mt-2 opacity-70">
              {counts.total} ENTR{counts.total === 1 ? "Y" : "IES"} · {counts.created} CREATED · {counts.joined} JOINED
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-ink px-4 sm:px-8 flex">
        {(["track", "map", "export"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 mono text-[11px] tracking-widest border-r border-ink ${tab === t ? "bg-ink text-paper" : "bg-paper text-ink"}`}
          >
            {t === "track" ? "TRACK RECORD" : t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {tab === "track" && (
          <div>
            {track.map((t) => (
              <TrackRow
                key={`${t.card.id}-${t.isCreator ? "c" : "j"}`}
                entry={t}
                avatarUrl={user.imageUrl}
              />
            ))}
            {track.length === 0 && (
              <div className="px-6 py-20 text-center">
                <div className="editorial font-black text-[34px]">Your track is empty.</div>
                <p className="mono text-[12px] opacity-70 mt-2">
                  Post a card — or join someone else's. Either way, it lands here.
                </p>
                <Link href="/" className="btn inline-block mt-6">＋ POST ONE THING</Link>
              </div>
            )}
          </div>
        )}

        {tab === "map" && (
          <div className="relative h-[calc(100dvh-330px)] sm:h-[calc(100dvh-280px)] min-h-[400px]">
            <ParisMap cards={mapCards} />
            <div
              className="absolute left-3 z-[400] mono text-[10px] tracking-widest bg-paper border border-ink px-2 py-1"
              style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
            >
              YOUR CONSTELLATION · {mapCards.length} PIN{mapCards.length === 1 ? "" : "S"}
            </div>
          </div>
        )}

        {tab === "export" && (
          <div className="px-4 sm:px-8 py-8 space-y-6 max-w-2xl">
            <div>
              <div className="editorial font-black text-[28px]">Carnet Poster</div>
              <p className="mono text-[11px] opacity-70 mt-2">
                High-res PNG of your Paris constellation — chronological trajectory through the city.
              </p>
              <button
                onClick={() =>
                  downloadCarnetPoster(
                    mapCards.map((c) => ({
                      lat: c.location.lat,
                      lng: c.location.lng,
                      label: c.location.label,
                      title: c.title,
                      createdAt: c.createdAt,
                    })),
                    displayName,
                  )
                }
                className="btn mt-3"
                disabled={mapCards.length === 0}
              >
                DOWNLOAD POSTER (1600×2000)
              </button>
            </div>

            <div className="border-t border-ink pt-6">
              <div className="editorial font-black text-[28px]">Carnet PDF</div>
              <p className="mono text-[11px] opacity-70 mt-2">
                All your cards stitched together · opens a print window — save as PDF.
              </p>
              <button
                onClick={() => exportCarnetPrintable(mapCards, displayName)}
                className="btn mt-3"
                disabled={mapCards.length === 0}
              >
                EXPORT AS PDF
              </button>
            </div>

            <div className="border-t border-ink pt-6 mono text-[11px] opacity-60">
              Want to change your name or avatar? Click the avatar in the top-right and
              pick „Manage account" — handled by Clerk.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrackRow({
  entry,
  avatarUrl,
}: {
  entry: TrackEntry;
  avatarUrl?: string;
}) {
  const { card, role, at, isCreator } = entry;
  const vibe = computeVibe({
    title: card.title,
    label: card.location.label,
    hour: parisHourOf(card.createdAt),
    category: card.category,
  });
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const status = card.archived || card.expiresAt <= now ? "ARCHIVED" : "ACTIVE";

  return (
    <div className="border-b border-ink flex items-stretch">
      <Link href={`/post/${card.id}`} className="flex-1 flex items-stretch min-w-0">
        <div
          className="w-24 sm:w-40 shrink-0 noise relative"
          style={{ backgroundImage: vibe.cssBackground }}
        >
          {vibe.isNight && <div className="absolute inset-0 stars" />}
          <div className="absolute left-2 top-2 mono text-[9px] tracking-widest text-paper bg-ink/85 px-1.5 py-0.5">
            {ACTIVITY_LABEL[vibe.activity]}
          </div>
          <div className="absolute right-2 bottom-2 mono text-[9px] tracking-widest text-paper bg-ink/85 px-1.5 py-0.5">
            {status}
          </div>
        </div>
        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-5 min-w-0">
          <div className="mono text-[10px] tracking-widest flex items-center gap-2 opacity-70">
            <span
              className={`px-1.5 py-0.5 border border-ink ${isCreator ? "bg-ink text-paper" : "bg-paper text-ink"}`}
            >
              {role}
            </span>
            <span>{card.location.label.toUpperCase()}</span>
            <span className="ml-auto">{timeAgo(at)}</span>
          </div>
          <h2 className="editorial font-black text-[24px] sm:text-[32px] mt-2 leading-[0.95]">
            {card.title}
          </h2>
          <div className="mt-3 mono text-[11px] opacity-70">
            {isCreator ? "BY YOU" : `BY ${card.owner.displayName.toUpperCase()}`} · {card.joiners.length}/{card.spots} SPOTS · {expiresIn(card.expiresAt).toUpperCase()}
          </div>
        </div>
      </Link>
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await shareCard(card, avatarUrl);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="w-16 sm:w-24 border-l border-ink mono text-[10px] tracking-widest hover:bg-ink hover:text-paper"
        aria-label="Share as image"
      >
        {busy ? "…" : "↗ SHARE"}
      </button>
    </div>
  );
}
