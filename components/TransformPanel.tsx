"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { Card, Permission } from "@/lib/types";
import {
  startsLabel, parisNow, wallClockToParisMs,
} from "@/lib/time";
import { combinedSearch, type LocationResult } from "@/lib/location";

type DayMode = "today" | "tomorrow" | "custom";
const SPOT_CHIPS = [2, 3, 4, 5, 6] as const;

function pad(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/**
 * The magic moment, made concrete: crystallize an IDEA into a THING. The
 * author adds only what's needed to make it joinable — a place, a start time,
 * a spot count. On submit, everyone who signalled resonance is carried over
 * as the warm first crew (invited). Resonance becomes reality.
 */
export function TransformPanel({
  card,
  onCancel,
}: {
  card: Card;
  onCancel: () => void;
}) {
  const router = useRouter();
  const { user } = useUser();
  const signalCount = card.signals.length;
  // When the signed-in user is not the idea's owner, this becomes a FORK:
  // the original idea is left untouched, the new thing is born under the
  // forker's name with an immutable credit back to the origin.
  const isFork = !!user && user.id !== card.ownerId;

  // Location: seed from the idea's loose location if it had one.
  const [query, setQuery] = useState(card.location?.label || "");
  const [latlng, setLatlng] = useState<{ lat: number; lng: number } | null>(
    card.location ? { lat: card.location.lat, lng: card.location.lng } : null,
  );
  const [picked, setPicked] = useState<LocationResult | null>(null);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [dayMode, setDayMode] = useState<DayMode | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [hour, setHour] = useState<number | null>(null);
  const [spots, setSpots] = useState<number | null>(null);
  const [permission, setPermission] = useState<Permission>("public");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query || query === picked?.label) { setSuggestions([]); return; }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      const ctrl = new AbortController();
      try { setSuggestions(await combinedSearch(query, ctrl.signal)); }
      finally { setSearching(false); }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, picked]);

  const startsAt = useMemo<Date | null>(() => {
    let d: Date | null = null;
    if (dayMode === "today") d = parisNow();
    else if (dayMode === "tomorrow") { d = parisNow(); d.setDate(d.getDate() + 1); }
    else if (dayMode === "custom" && customDate) {
      const [y, m, dd] = customDate.split("-").map(Number);
      d = parisNow(); d.setFullYear(y, m - 1, dd);
    }
    if (!d || hour === null) return null;
    d.setHours(hour, 0, 0, 0);
    return new Date(wallClockToParisMs(d));
  }, [dayMode, customDate, hour]);

  const hourChips = useMemo(() => {
    const base = [11, 13, 15, 17, 18, 19, 20, 21, 22];
    if (dayMode !== "today") return base;
    const min = parisNow().getHours() + 1;
    return base.filter((h) => h >= min);
  }, [dayMode]);

  const todayValue = useMemo(() => isoDate(parisNow()), []);
  const canSubmit = !!latlng && !!startsAt && spots !== null && !submitting;
  const chipBase = "px-3 py-2 border border-rule-strong mono text-[10px] tracking-widest";

  const missing = [
    !latlng && "PLACE",
    !startsAt && "WHEN",
    spots === null && "SPOTS",
  ].filter(Boolean) as string[];

  async function submit() {
    if (!canSubmit || !latlng || !startsAt) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/cards/${card.id}/transform`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location: { lat: latlng.lat, lng: latlng.lng, label: picked?.label || query.trim() || "Paris" },
          spots,
          permission,
          startsAt: startsAt.toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json?.error || "Transform failed"); return; }
      // Owner path keeps the original id; fork path returns a fresh one.
      const dest = typeof json.id === "string" && json.id ? json.id : card.id;
      router.push(`/post/${dest}?new=thing`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-rule-strong bg-paper animate-fadeIn">
      <div className="px-4 py-3 bg-ink text-paper mono text-[11px] tracking-widest flex items-center justify-between">
        <span>{isFork ? "FORK INTO A THING — IDEA → THING" : "MAKE IT REAL — IDEA → THING"}</span>
        <button onClick={onCancel} className="opacity-70 hover:opacity-100">✕</button>
      </div>

      <div className="p-4 space-y-5">
        {isFork && (
          <div className="border border-rule-strong rounded-2xl p-3 cp-idea-frame">
            <p className="mono text-[11px] leading-relaxed">
              You&rsquo;re forking <span className="font-bold">@{card.owner.displayName}</span>&rsquo;s
              idea into your own thing. The original idea stays where it
              is — others can still fork it too. Your new thing will
              carry an unchangeable credit back to it, and
              <span className="font-bold"> @{card.owner.displayName}</span> will land in
              your invited first crew alongside every signaler.
            </p>
          </div>
        )}
        <p className="mono text-[11px] opacity-70 leading-relaxed">
          {signalCount > 0 ? (
            <>
              <span className="font-bold">{signalCount}</span> {signalCount === 1 ? "person has" : "people have"}{" "}
              signalled they want this real. The moment you publish, they&rsquo;re
              carried over as your invited first crew.
            </>
          ) : (
            <>No signals yet — that&rsquo;s fine. You can make it real anyway and gather a crew as a Thing.</>
          )}
        </p>

        {/* WHERE */}
        <div>
          <label className="mono text-[10px] tracking-widest opacity-70">
            WHERE {searching && <span className="ml-2 opacity-60">SEARCHING…</span>}
          </label>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
              placeholder="A venue, street, or quartier"
              className="input mt-1"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full bg-paper border border-rule-strong border-t-0 z-20 max-h-60 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.label}-${i}`}
                    type="button"
                    onClick={() => {
                      setPicked(s); setQuery(s.label);
                      setLatlng({ lat: s.lat, lng: s.lng }); setSuggestions([]);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-ink hover:text-paper border-b border-rule last:border-b-0"
                  >
                    <div className="font-medium text-[13px] leading-tight">{s.label}</div>
                    <div className="mono text-[9px] tracking-widest opacity-60 mt-0.5">
                      {s.source === "quartier" ? "◆ " : "● "}{s.hint || "PARIS"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {latlng && (
            <div className="mono text-[10px] mt-2 opacity-70">
              📍 {latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)}
            </div>
          )}
        </div>

        {/* WHEN */}
        <div>
          <label className="mono text-[10px] tracking-widest opacity-70">WHEN DOES IT START?</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["today", "tomorrow", "custom"] as DayMode[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setDayMode(d); if (d !== "custom") setCustomDate(""); setHour(null); }}
                className={`${chipBase} ${dayMode === d ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
              >
                {d === "today" ? "TODAY" : d === "tomorrow" ? "TOMORROW" : "CUSTOM DAY"}
              </button>
            ))}
          </div>
          {dayMode === "custom" && (
            <input
              type="date"
              value={customDate}
              min={todayValue}
              onChange={(e) => { setCustomDate(e.target.value); setHour(null); }}
              className="input mt-2 max-w-[200px]"
            />
          )}
          {dayMode && (dayMode !== "custom" || customDate) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {hourChips.length === 0 && (
                <span className="mono text-[11px] opacity-60">TOO LATE TODAY — PICK TOMORROW</span>
              )}
              {hourChips.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHour(h)}
                  className={`${chipBase} w-11 text-center tabular-nums ${hour === h ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                >
                  {pad(h)}H
                </button>
              ))}
            </div>
          )}
          {startsAt && (
            <p className="mono text-[10px] mt-3 opacity-70">HAPPENS · {startsLabel(startsAt.getTime())}</p>
          )}
        </div>

        {/* SPOTS */}
        <div>
          <label className="mono text-[10px] tracking-widest opacity-70">HOW MANY PEOPLE?</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {SPOT_CHIPS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSpots(n)}
                className={`${chipBase} w-11 text-center ${spots === n ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={99}
              value={spots ?? ""}
              onChange={(e) => setSpots(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              placeholder="·"
              className="input w-20 tabular-nums"
            />
          </div>
        </div>

        {/* PERMISSION */}
        <div>
          <label className="mono text-[10px] tracking-widest opacity-70">JOIN PERMISSION</label>
          <div className="mt-1 flex">
            <button
              type="button"
              onClick={() => setPermission("public")}
              className={`flex-1 px-3 py-2 border border-rule-strong mono text-[10px] tracking-widest ${permission === "public" ? "bg-ink text-paper" : "bg-paper"}`}
            >
              PUBLIC JOIN
            </button>
            <button
              type="button"
              onClick={() => setPermission("request")}
              className={`flex-1 px-3 py-2 border border-rule-strong border-l-0 mono text-[10px] tracking-widest ${permission === "request" ? "bg-ink text-paper" : "bg-paper"}`}
            >
              REQUEST TO JOIN
            </button>
          </div>
          {signalCount > 0 && (
            <p className="mono text-[10px] mt-2 opacity-60">
              Signalers come in as invited — you accept them from the new Thing.
            </p>
          )}
        </div>

        {error && <p className="mono text-[11px] text-red-700">{error.toUpperCase()}</p>}
      </div>

      <div className="border-t border-rule-strong px-4 py-3">
        {missing.length > 0 && (
          <p className="mono text-[10px] opacity-60 mb-2">STILL NEEDED · {missing.join(" · ")}</p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="btn ghost" disabled={submitting}>Cancel</button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={`btn ${canSubmit ? "cp-ready" : "opacity-40"}`}
          >
            {submitting ? "Making it real…" : "Make it real →"}
          </button>
        </div>
      </div>
    </div>
  );
}
