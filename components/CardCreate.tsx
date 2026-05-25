"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ACTIVITY_ACCENT, ACTIVITY_GLYPH, ACTIVITY_LABEL, CATEGORY_ORDER, type Activity } from "@/lib/vibe";
import { COLOR_PALETTE, cardColor, isDark } from "@/lib/color";
import type { Permission } from "@/lib/types";
import { startsLabel } from "@/lib/time";
import { combinedSearch, type LocationResult } from "@/lib/location";
import { fetchActiveCards } from "@/lib/db";
import { useIsDesktop } from "@/lib/hooks";
import type { Card } from "@/lib/types";
import { ParisMap } from "./ParisMap";

type DayMode = "today" | "tomorrow" | "custom";
type SpotPreset = 2 | 3 | 4 | 5 | 6;
const SPOT_CHIPS: SpotPreset[] = [2, 3, 4, 5, 6];

function pad(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function CardCreate({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Activity | null>(null);
  const [color, setColor] = useState<string | null>(null);

  const [spots, setSpots] = useState<number>(4);
  const [spotsCustom, setSpotsCustom] = useState<boolean>(false);
  const [permission, setPermission] = useState<Permission>("public");

  // When? two-stage picker
  const [dayMode, setDayMode] = useState<DayMode | null>(null);
  const [customDate, setCustomDate] = useState<string>("");          // YYYY-MM-DD
  const [hour, setHour] = useState<number | null>(null);
  const [customHM, setCustomHM] = useState<string>("");              // HH:MM
  const [showCustomTime, setShowCustomTime] = useState(false);

  // Color picker popover
  const [colorOpen, setColorOpen] = useState(false);

  // Location autocomplete
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<LocationResult | null>(null);
  const [latlng, setLatlng] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const isDesktop = useIsDesktop();
  const [existingCards, setExistingCards] = useState<Card[]>([]);
  useEffect(() => {
    if (!isDesktop) return;
    fetchActiveCards().then(setExistingCards).catch(() => {});
  }, [isDesktop]);

  // ====== derived values ======

  const startsAt = useMemo<Date | null>(() => {
    let d: Date | null = null;
    if (dayMode === "today") d = new Date();
    else if (dayMode === "tomorrow") { d = new Date(); d.setDate(d.getDate() + 1); }
    else if (dayMode === "custom" && customDate) {
      const [y, m, dd] = customDate.split("-").map(Number);
      d = new Date();
      d.setFullYear(y, m - 1, dd);
    }
    if (!d) return null;

    if (hour !== null) {
      d.setHours(hour, 0, 0, 0);
    } else if (customHM) {
      const [hh, mm] = customHM.split(":").map(Number);
      d.setHours(hh, mm, 0, 0);
    } else {
      return null; // day set, time not yet
    }

    return d;
  }, [dayMode, customDate, hour, customHM]);

  const hourChips = useMemo(() => {
    const base = [11, 13, 15, 17, 18, 19, 20, 21, 22];
    if (dayMode !== "today") return base;
    const now = new Date();
    const min = now.getHours() + 1;
    return base.filter((h) => h >= min);
  }, [dayMode]);

  const customDayLabel = useMemo(() => {
    if (!customDate) return "";
    const d = new Date(customDate + "T00:00:00");
    return d
      .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
      .toUpperCase();
  }, [customDate]);

  const todayValue = useMemo(() => isoDate(new Date()), []);

  const previewColor = useMemo(
    () => cardColor({ color, category, title }),
    [color, category, title],
  );
  const previewDark = useMemo(() => isDark(previewColor), [previewColor]);

  // ====== location autocomplete with debounced async fetch ======

  useEffect(() => {
    if (!query || query === picked?.label) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      const ctrl = new AbortController();
      try {
        const results = await combinedSearch(query, ctrl.signal);
        setSuggestions(results);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, picked]);

  function pickLocation(r: LocationResult) {
    setPicked(r);
    setQuery(r.label);
    setLatlng({ lat: r.lat, lng: r.lng });
    setSuggestions([]);
  }

  // ====== submit ======

  async function submit() {
    if (!title.trim() || !latlng || !startsAt) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          location: {
            lat: latlng.lat,
            lng: latlng.lng,
            label: picked?.label || query.trim() || "Paris",
          },
          spots,
          permission,
          category,
          color,
          startsAt: startsAt.toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to post");
        return;
      }
      onClose();
      router.push(`/post/${json.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!title.trim() && !!latlng && !!startsAt && !submitting;
  const chipBase = "px-3 py-2 border border-ink mono text-[10px] tracking-widest";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The color-swatch + close cluster is identical in both layouts.
  const topBarRight = (
    <div className="flex items-center gap-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setColorOpen((o) => !o)}
          className="w-7 h-7 border border-ink hover:scale-105 transition"
          style={{ backgroundColor: previewColor }}
          title="Pick a color"
          aria-label="Pick a color"
        />
        {colorOpen && (
          <div className="absolute right-0 top-full mt-2 z-50 bg-paper border border-ink p-2 w-[208px] animate-fadeIn shadow-xl">
            <div className="grid grid-cols-6 gap-1">
              {COLOR_PALETTE.map((c) => {
                const active = color === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => { setColor(c.value); setColorOpen(false); }}
                    title={c.label}
                    aria-label={c.label}
                    className={`w-7 h-7 border ${active ? "border-ink ring-2 ring-ink ring-offset-1 ring-offset-paper" : "border-ink/20 hover:border-ink"}`}
                    style={{ backgroundColor: c.value }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 mono text-[10px] tracking-widest">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="color"
                  value={color || "#0a0a0a"}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-6 h-6 border border-ink p-0 cursor-pointer bg-paper"
                />
                CUSTOM
              </label>
              {color && (
                <button
                  type="button"
                  onClick={() => { setColor(null); setColorOpen(false); }}
                  className="hover:underline"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <button onClick={onClose} className="mono text-[11px] tracking-widest hover:underline">
        CLOSE ✕
      </button>
    </div>
  );

  // Desktop side-panel: full Paris map on the left, configurator on the right.
  if (isDesktop) {
    const desktopNode = (
      <div className="fixed inset-0 z-[1200] flex bg-paper">
        {/* main map */}
        <div className="flex-1 relative min-w-0">
          <ParisMap
            cards={existingCards}
            selectable
            pickedLatLng={latlng}
            onPick={(ll) => {
              setLatlng(ll);
              setPicked(null);
              if (!query) setQuery("Custom pin");
            }}
            gestureHandling={false}
          />
          <div className="absolute left-4 top-4 z-[400] mono text-[10px] tracking-widest bg-paper border border-ink px-3 py-2 shadow-lg max-w-[300px]">
            {latlng
              ? `PIN · ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)} · CLICK TO MOVE`
              : "CLICK / TAP THE MAP TO DROP YOUR PIN"}
          </div>
        </div>

        {/* sidebar */}
        <aside className="w-[420px] shrink-0 flex flex-col border-l border-ink bg-paper">
          <div className="relative flex items-center justify-between border-b border-ink px-4 py-4 shrink-0">
            <div className="mono text-[10px] tracking-widest opacity-70">NEW · ONE THING</div>
            {topBarRight}
          </div>

          {/* preview banner */}
          <div
            className="h-24 transition-colors duration-300 shrink-0"
            style={{ backgroundColor: previewColor }}
          >
            <div className="h-full flex items-end p-4">
              <div>
                <div
                  className={`mono text-[10px] tracking-widest px-1.5 py-0.5 inline-block ${previewDark ? "bg-paper text-ink" : "bg-ink text-paper"}`}
                >
                  LIVE PREVIEW
                </div>
                <div
                  className={`editorial font-black text-[18px] mt-1.5 max-w-[80%] line-clamp-1 ${previewDark ? "text-paper" : "text-ink"}`}
                >
                  {title || "What's your one thing this week?"}
                </div>
              </div>
            </div>
          </div>

          {/* form body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-5">
            {/* TITLE */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">TITLE</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A film night about loneliness. Sunday, my place."
                className="input mt-1"
                maxLength={140}
              />
            </div>

            {/* CATEGORY */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">CATEGORY</label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {CATEGORY_ORDER.map((c) => {
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`group aspect-[3/2] border border-ink flex flex-col items-center justify-center gap-1 transition ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                      aria-pressed={active}
                    >
                      <span
                        className={`text-[20px] leading-none ${active ? "text-paper" : "group-hover:text-paper"}`}
                        style={!active ? { color: ACTIVITY_ACCENT[c] } : undefined}
                      >
                        {ACTIVITY_GLYPH[c]}
                      </span>
                      <span className="mono text-[9px] tracking-widest">
                        {ACTIVITY_LABEL[c]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">DESCRIPTION</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="A few sentences. Who is this for. What kind of energy."
                className="input mt-1 resize-none"
                maxLength={500}
              />
            </div>

            {/* PEOPLE */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">PEOPLE</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {SPOT_CHIPS.map((n) => {
                  const active = !spotsCustom && spots === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setSpots(n); setSpotsCustom(false); }}
                      className={`${chipBase} w-11 text-center ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                    >
                      {n}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSpotsCustom((v) => !v)}
                  className={`${chipBase} ${spotsCustom ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                >
                  + MORE
                </button>
                {spotsCustom && (
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={spots}
                    onChange={(e) =>
                      setSpots(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                    }
                    className="input w-20 tabular-nums"
                    autoFocus
                  />
                )}
              </div>
            </div>

            {/* WHEN */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">
                WHEN DOES IT START?
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                {(["today", "tomorrow", "custom"] as DayMode[]).map((d) => {
                  const active = dayMode === d;
                  const label =
                    d === "today" ? "TODAY"
                    : d === "tomorrow" ? "TOMORROW"
                    : (active && customDayLabel) || "CUSTOM DAY";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDayMode(d);
                        if (d !== "custom") setCustomDate("");
                        setHour(null);
                        setCustomHM("");
                        setShowCustomTime(false);
                      }}
                      className={`${chipBase} ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {dayMode === "custom" && (
                <input
                  type="date"
                  value={customDate}
                  min={todayValue}
                  onChange={(e) => { setCustomDate(e.target.value); setHour(null); setCustomHM(""); }}
                  className="input mt-2 max-w-[200px]"
                  autoFocus
                />
              )}

              {dayMode && (dayMode !== "custom" || customDate) && (
                <div className="mt-3">
                  <div className="mono text-[10px] tracking-widest opacity-60">WHAT TIME?</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {hourChips.length === 0 && (
                      <span className="mono text-[11px] opacity-60">
                        TOO LATE TODAY — PICK TOMORROW
                      </span>
                    )}
                    {hourChips.map((h) => {
                      const active = !customHM && hour === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => { setHour(h); setCustomHM(""); setShowCustomTime(false); }}
                          className={`${chipBase} w-11 text-center tabular-nums ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                        >
                          {String(h).padStart(2, "0")}H
                        </button>
                      );
                    })}
                    {!showCustomTime ? (
                      <button
                        type="button"
                        onClick={() => { setShowCustomTime(true); setHour(null); }}
                        className={`${chipBase} bg-paper hover:bg-ink hover:text-paper`}
                      >
                        + CUSTOM
                      </button>
                    ) : (
                      <input
                        type="time"
                        autoFocus
                        value={customHM}
                        onChange={(e) => { setCustomHM(e.target.value); setHour(null); }}
                        onBlur={() => { if (!customHM) setShowCustomTime(false); }}
                        className="input w-28 animate-fadeIn"
                        placeholder="HH:MM"
                      />
                    )}
                  </div>
                </div>
              )}

              {startsAt && (
                <p className="mono text-[10px] mt-3 opacity-70 leading-relaxed">
                  HAPPENS · {startsLabel(startsAt.getTime())}
                  <span className="opacity-60"> · HIDES ONCE FULL OR STARTED</span>
                </p>
              )}
            </div>

            {/* PERMISSION */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">JOIN PERMISSION</label>
              <div className="mt-1 flex">
                <button
                  type="button"
                  onClick={() => setPermission("public")}
                  className={`flex-1 px-3 py-2 border border-ink mono text-[10px] tracking-widest ${permission === "public" ? "bg-ink text-paper" : "bg-paper"}`}
                >
                  PUBLIC JOIN
                </button>
                <button
                  type="button"
                  onClick={() => setPermission("request")}
                  className={`flex-1 px-3 py-2 border border-ink border-l-0 mono text-[10px] tracking-widest ${permission === "request" ? "bg-ink text-paper" : "bg-paper"}`}
                >
                  REQUEST TO JOIN
                </button>
              </div>
            </div>

            {/* LOCATION — search OR click on the map */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">
                LOCATION
                {searching && <span className="ml-2 opacity-60">SEARCHING…</span>}
              </label>
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
                  placeholder="Search a shop, street, quartier — or click the map"
                  className="input mt-1"
                />
                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full bg-paper border border-ink border-t-0 z-20 max-h-72 overflow-y-auto">
                    {suggestions.map((s, i) => (
                      <button
                        key={`${s.label}-${s.lat}-${s.lng}-${i}`}
                        type="button"
                        onClick={() => pickLocation(s)}
                        className="block w-full text-left px-3 py-2 hover:bg-ink hover:text-paper border-b border-rule last:border-b-0"
                      >
                        <div className="font-medium text-[13px] leading-tight">{s.label}</div>
                        <div className="mono text-[9px] tracking-widest opacity-60 mt-0.5">
                          {s.source === "quartier" ? "◆ " : "● "}
                          {s.hint || "PARIS"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {latlng && (
                <div className="mono text-[10px] mt-2 opacity-70">
                  📍 {latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)}
                  {picked?.hint ? ` · ${picked.hint}` : ""}
                </div>
              )}
              <p className="mono text-[10px] mt-1 opacity-50">
                The pin lands wherever you click on the big map.
              </p>
            </div>

            {error && (
              <p className="mono text-[11px] text-red-700">{error.toUpperCase()}</p>
            )}
          </div>

          {/* action bar */}
          <div
            className="border-t border-ink px-4 py-3 flex items-center justify-end gap-2 shrink-0"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            <button onClick={onClose} className="btn ghost" disabled={submitting}>Cancel</button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className={`btn ${!canSubmit ? "opacity-40" : ""}`}
            >
              {submitting ? "Posting…" : "Post →"}
            </button>
          </div>
        </aside>
      </div>
    );
    if (!mounted) return null;
    return createPortal(desktopNode, document.body);
  }

  const node = (
    <div className="fixed inset-0 z-[1200] flex sm:items-center sm:justify-center sm:bg-ink/60 sm:p-6">
      <div className="bg-paper flex flex-col w-full h-full sm:max-w-[1100px] sm:max-h-[90vh] sm:h-auto sm:border sm:border-ink sm:shadow-2xl">
      <div
        className="relative flex items-center justify-between border-b border-ink px-4 sm:px-6 py-3 sm:py-4 shrink-0 safe-top"
      >
        <div className="mono text-[10px] tracking-widest opacity-70">NEW · ONE THING</div>
        {topBarRight}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* solid color preview */}
        <div
          className="relative h-40 sm:h-56 transition-colors duration-300"
          style={{ backgroundColor: previewColor }}
        >
          <div className="absolute inset-0 flex items-end p-4 sm:p-6">
            <div>
              <div
                className={`mono text-[10px] tracking-widest px-1.5 py-0.5 inline-block ${previewDark ? "bg-paper text-ink" : "bg-ink text-paper"}`}
              >
                LIVE PREVIEW
              </div>
              <div
                className={`editorial font-black text-[22px] sm:text-[30px] mt-2 max-w-[80%] ${previewDark ? "text-paper" : "text-ink"}`}
              >
                {title || "What's your one thing this week?"}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
          <div className="space-y-5">
            {/* TITLE */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">TITLE</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A film night about loneliness. Sunday, my place."
                className="input mt-1"
                maxLength={140}
              />
            </div>

            {/* CATEGORY */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">CATEGORY</label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {CATEGORY_ORDER.map((c) => {
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`group aspect-[3/2] border border-ink flex flex-col items-center justify-center gap-1 transition ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                      aria-pressed={active}
                    >
                      <span
                        className={`text-[22px] leading-none ${active ? "text-paper" : "group-hover:text-paper"}`}
                        style={!active ? { color: ACTIVITY_ACCENT[c] } : undefined}
                      >
                        {ACTIVITY_GLYPH[c]}
                      </span>
                      <span className="mono text-[10px] tracking-widest">
                        {ACTIVITY_LABEL[c]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">DESCRIPTION</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="A few sentences. Who is this for. What kind of energy."
                className="input mt-1 resize-none"
                maxLength={500}
              />
            </div>

            {/* PEOPLE */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">PEOPLE</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {SPOT_CHIPS.map((n) => {
                  const active = !spotsCustom && spots === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setSpots(n); setSpotsCustom(false); }}
                      className={`${chipBase} w-12 text-center ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                    >
                      {n}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSpotsCustom((v) => !v)}
                  className={`${chipBase} ${spotsCustom ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                >
                  + MORE
                </button>
                {spotsCustom && (
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={spots}
                    onChange={(e) =>
                      setSpots(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                    }
                    className="input w-20 tabular-nums"
                    autoFocus
                  />
                )}
              </div>
            </div>

            {/* WHEN — two stage */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">
                WHEN DOES IT START?
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                {(["today", "tomorrow", "custom"] as DayMode[]).map((d) => {
                  const active = dayMode === d;
                  const label =
                    d === "today" ? "TODAY"
                    : d === "tomorrow" ? "TOMORROW"
                    : (active && customDayLabel) || "CUSTOM DAY";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDayMode(d);
                        if (d !== "custom") setCustomDate("");
                        // reset time when day changes
                        setHour(null);
                        setCustomHM("");
                        setShowCustomTime(false);
                      }}
                      className={`${chipBase} ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {dayMode === "custom" && (
                <input
                  type="date"
                  value={customDate}
                  min={todayValue}
                  onChange={(e) => { setCustomDate(e.target.value); setHour(null); setCustomHM(""); }}
                  className="input mt-2 max-w-[200px]"
                  autoFocus
                />
              )}

              {/* Time chips appear once a day is fully chosen */}
              {dayMode && (dayMode !== "custom" || customDate) && (
                <div className="mt-3">
                  <div className="mono text-[10px] tracking-widest opacity-60">
                    WHAT TIME?
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {hourChips.length === 0 && (
                      <span className="mono text-[11px] opacity-60">
                        TOO LATE TODAY — PICK TOMORROW
                      </span>
                    )}
                    {hourChips.map((h) => {
                      const active = !customHM && hour === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => {
                            setHour(h);
                            setCustomHM("");
                            setShowCustomTime(false);
                          }}
                          className={`${chipBase} w-12 text-center tabular-nums ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                        >
                          {String(h).padStart(2, "0")}H
                        </button>
                      );
                    })}
                    {!showCustomTime ? (
                      <button
                        type="button"
                        onClick={() => { setShowCustomTime(true); setHour(null); }}
                        className={`${chipBase} bg-paper hover:bg-ink hover:text-paper`}
                      >
                        + CUSTOM
                      </button>
                    ) : (
                      <input
                        type="time"
                        autoFocus
                        value={customHM}
                        onChange={(e) => { setCustomHM(e.target.value); setHour(null); }}
                        onBlur={() => { if (!customHM) setShowCustomTime(false); }}
                        className="input w-28 animate-fadeIn"
                        placeholder="HH:MM"
                      />
                    )}
                  </div>
                </div>
              )}

              {startsAt && (
                <p className="mono text-[10px] mt-3 opacity-70">
                  HAPPENS · {startsLabel(startsAt.getTime())}
                  <span className="opacity-60"> · HIDES FROM PUBLIC ONCE FULL OR STARTED</span>
                </p>
              )}
            </div>

            {/* JOIN PERMISSION */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">JOIN PERMISSION</label>
              <div className="mt-1 flex">
                <button
                  type="button"
                  onClick={() => setPermission("public")}
                  className={`flex-1 px-3 py-2 border border-ink mono text-[10px] tracking-widest ${permission === "public" ? "bg-ink text-paper" : "bg-paper"}`}
                >
                  PUBLIC JOIN
                </button>
                <button
                  type="button"
                  onClick={() => setPermission("request")}
                  className={`flex-1 px-3 py-2 border border-ink border-l-0 mono text-[10px] tracking-widest ${permission === "request" ? "bg-ink text-paper" : "bg-paper"}`}
                >
                  REQUEST TO JOIN
                </button>
              </div>
            </div>

            {/* LOCATION */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">
                LOCATION
                {searching && <span className="ml-2 opacity-60">SEARCHING…</span>}
              </label>
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
                  placeholder="Le Comptoir Général, 27 rue Volta, Belleville…"
                  className="input mt-1"
                />
                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full bg-paper border border-ink border-t-0 z-20 max-h-72 overflow-y-auto">
                    {suggestions.map((s, i) => (
                      <button
                        key={`${s.label}-${s.lat}-${s.lng}-${i}`}
                        type="button"
                        onClick={() => pickLocation(s)}
                        className="block w-full text-left px-3 py-2 hover:bg-ink hover:text-paper border-b border-rule last:border-b-0"
                      >
                        <div className="font-medium text-[13px] leading-tight">{s.label}</div>
                        <div className="mono text-[9px] tracking-widest opacity-60 mt-0.5">
                          {s.source === "quartier" ? "◆ " : "● "}
                          {s.hint || "PARIS"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {latlng && (
                <div className="mono text-[10px] mt-2 opacity-70">
                  PIN · {latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)}
                </div>
              )}
              <p className="mono text-[10px] mt-1 opacity-50">
                Real Paris addresses + venues — type a shop, bar, street, quartier.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="mono text-[10px] tracking-widest opacity-70">PIN ON MAP</label>
            <div className="border border-ink h-[460px] sm:h-[520px]">
              <ParisMap
                cards={[]}
                selectable
                pickedLatLng={latlng}
                onPick={(ll) => {
                  setLatlng(ll);
                  setPicked(null);
                  if (!query) setQuery("Custom pin");
                }}
              />
            </div>
            <p className="mono text-[10px] opacity-60">
              CLICK / TAP THE MAP TO DROP A PIN. DRAG TO ADJUST.
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 border-t border-ink mono text-[11px] bg-ink text-paper">
          ONE LIVE CARD PER PERSON — POSTING AUTO-ARCHIVES YOUR CURRENT ONE (IF ANY) INTO YOUR CARNET.
        </div>
        {error && (
          <div className="px-4 sm:px-6 py-3 mono text-[11px] text-red-700">
            {error.toUpperCase()}
          </div>
        )}
      </div>

      <div
        className="border-t border-ink px-4 sm:px-6 py-3 flex items-center justify-end gap-2 shrink-0"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <button onClick={onClose} className="btn ghost" disabled={submitting}>
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className={`btn ${!canSubmit ? "opacity-40" : ""}`}
        >
          {submitting ? "Posting…" : "Post →"}
        </button>
      </div>
      </div>
    </div>
  );

  // Portal to document.body so the modal escapes any parent stacking
  // context (iOS Safari traps fixed children inside scrollable mains).
  if (!mounted) return null;
  return createPortal(node, document.body);
}
