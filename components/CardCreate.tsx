"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COLOR_PALETTE, cardColor, isDark } from "@/lib/color";
import type { CardModule, Permission } from "@/lib/types";
import {
  startsLabel, parisNow, parisParts, wallClockToParisMs,
  parisWallTimeToMs, parisClockLabel,
} from "@/lib/time";
import { combinedSearch, type LocationResult } from "@/lib/location";
import { fetchActiveCards } from "@/lib/db";
import { useIsDesktop } from "@/lib/hooks";
import type { Card } from "@/lib/types";
import { ParisMap } from "./ParisMap";
import { TagInput } from "./TagInput";
import { ModuleDraftPicker } from "./modules/ModuleDraftPicker";

const TAG_SUGGESTIONS = [
  "film", "music", "art", "fashion", "food", "walks",
  "photography", "design", "shooting", "book", "build", "talk",
];

/**
 * Optional pre-filled draft fields. The AI step-1 produces these; passing
 * them in primes the composer so the user only edits, doesn't re-type.
 *
 * Anything `null` in a draft means "AI couldn't infer this — let the user
 * fill it in". Anything in `inferred` was guessed by the AI rather than
 * extracted verbatim, and gets a ✦ hint next to the label.
 */
export interface CardDraft {
  /** Which object the AI judged this to be. Defaults to "thing" downstream. */
  kind?: "idea" | "thing";
  title?: string;
  description?: string | null;
  tags?: string[];
  location?: { lat: number; lng: number; label: string };
  /** Free-form query string (e.g. "Le Marais") to run through Photon if
   *  no `location` was resolved server-side. */
  locationQuery?: string | null;
  startsAtIso?: string | null;
  endsAtIso?: string | null;
  spots?: number | null;
  permission?: Permission | null;
  color?: string | null;
  externalUrl?: string | null;
  /** Field names that the AI inferred rather than extracted. */
  inferred?: string[];
}

type DayMode = "today" | "tomorrow" | "custom";
type SpotPreset = 2 | 3 | 4 | 5 | 6;
const SPOT_CHIPS: SpotPreset[] = [2, 3, 4, 5, 6];

type EndsMode = "1h" | "2h" | "3h" | "evening" | "open" | "custom" | null;
const ENDS_CHIPS: { mode: EndsMode; label: string }[] = [
  { mode: "1h", label: "1H" },
  { mode: "2h", label: "2H" },
  { mode: "3h", label: "3H" },
  { mode: "evening", label: "EVENING" },
  { mode: "open", label: "OPEN-ENDED" },
];

function pad(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function CardCreate({
  onClose,
  initialDraft,
  onBack,
}: {
  onClose: () => void;
  initialDraft?: CardDraft | null;
  /** When set, shown as "← BACK" so the user can return to the AI prompt step. */
  onBack?: () => void;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initialDraft?.title || "");
  const [description, setDescription] = useState(initialDraft?.description || "");
  const [tags, setTags] = useState<string[]>(initialDraft?.tags || []);
  const [color, setColor] = useState<string | null>(initialDraft?.color ?? null);
  // Optional draft module to attach on POST. Null = no module.
  const [draftModule, setDraftModule] = useState<CardModule | null>(null);

  // Spots is null until the user (or AI with confidence) picks a number.
  // Submit is disabled while null — we never default to a silent value.
  const [spots, setSpots] = useState<number | null>(initialDraft?.spots ?? null);
  const [spotsCustom, setSpotsCustom] = useState<boolean>(
    !!(initialDraft?.spots && ![2, 3, 4, 5, 6].includes(initialDraft.spots)),
  );
  // Permission defaults to "public" — the friendly, most-common choice.
  // The AI can override to "request"; the user can flip it. No forced pick.
  const [permission, setPermission] = useState<Permission>(
    initialDraft?.permission ?? "public",
  );

  // Track which fields are AI-guessed (not user-confirmed). Touching a
  // field removes it from the set — the ✦ label hint disappears the moment
  // the user interacts. We start from `initialDraft.inferred`.
  const [inferredSet, setInferredSet] = useState<Set<string>>(
    () => new Set(initialDraft?.inferred || []),
  );
  function confirm(field: string) {
    setInferredSet((s) => {
      if (!s.has(field)) return s;
      const next = new Set(s);
      next.delete(field);
      return next;
    });
  }
  function inferredHint(field: string) {
    if (!inferredSet.has(field)) return null;
    return (
      <span className="ml-2 mono text-[9px] tracking-widest opacity-50 select-none">
        ✦ AI GUESSED
      </span>
    );
  }

  // When? two-stage picker, possibly seeded from AI's startsAtIso.
  const [dayMode, setDayMode] = useState<DayMode | null>(null);
  const [customDate, setCustomDate] = useState<string>("");          // YYYY-MM-DD
  const [hour, setHour] = useState<number | null>(null);
  const [customHM, setCustomHM] = useState<string>("");              // HH:MM
  const [showCustomTime, setShowCustomTime] = useState(false);

  // How long? Chip presets compute endsAt relative to startsAt; "open" =
  // null (no end), "custom" lets the user pick a specific end time.
  const [endsMode, setEndsMode] = useState<EndsMode>(null);
  const [customEndHM, setCustomEndHM] = useState<string>("");        // HH:MM for "custom"

  // Hydrate when-picker from AI initialDraft.startsAtIso on mount, reading
  // the instant in *Paris* terms so the picker reflects what the card will
  // actually mean (not the visitor's local wall-clock).
  useEffect(() => {
    if (!initialDraft?.startsAtIso) return;
    const ts = Date.parse(initialDraft.startsAtIso);
    if (!Number.isFinite(ts)) return;
    const p = parisParts(ts);
    const todayP = parisParts(Date.now());
    const tomorrowP = parisParts(Date.now() + 86_400_000);

    const sameDay = (a: typeof p, b: typeof p) =>
      a.y === b.y && a.mo === b.mo && a.d === b.d;

    if (sameDay(p, todayP)) setDayMode("today");
    else if (sameDay(p, tomorrowP)) setDayMode("tomorrow");
    else {
      setDayMode("custom");
      setCustomDate(`${p.y}-${pad(p.mo + 1)}-${pad(p.d)}`);
    }
    if (p.mi === 0 && p.h >= 6) setHour(p.h);
    else setCustomHM(`${pad(p.h)}:${pad(p.mi)}`);
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate ends-mode from AI initialDraft.endsAtIso on mount.
  useEffect(() => {
    if (!initialDraft?.endsAtIso || !initialDraft?.startsAtIso) return;
    const start = Date.parse(initialDraft.startsAtIso);
    const end = Date.parse(initialDraft.endsAtIso);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    const diffMin = Math.round((end - start) / 60_000);
    if (diffMin === 60) setEndsMode("1h");
    else if (diffMin === 120) setEndsMode("2h");
    else if (diffMin === 180) setEndsMode("3h");
    else {
      setEndsMode("custom");
      const ep = parisParts(end);
      setCustomEndHM(`${pad(ep.h)}:${pad(ep.mi)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Color picker popover
  const [colorOpen, setColorOpen] = useState(false);

  // Location autocomplete. Seed from AI-resolved location or query.
  const [query, setQuery] = useState(
    initialDraft?.location?.label || initialDraft?.locationQuery || "",
  );
  const [picked, setPicked] = useState<LocationResult | null>(null);
  const [latlng, setLatlng] = useState<{ lat: number; lng: number } | null>(
    initialDraft?.location
      ? { lat: initialDraft.location.lat, lng: initialDraft.location.lng }
      : null,
  );
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Whether the suggestions dropdown is visible. Decoupled from `suggestions`
  // so the user can dismiss it (Escape / blur / map-click / "use my text")
  // without it snapping back open.
  const [suggestOpen, setSuggestOpen] = useState(false);

  // If AI gave us a locationQuery but no resolved lat/lng, kick off Photon
  // immediately so the first suggestion can be auto-picked.
  useEffect(() => {
    if (!initialDraft?.locationQuery || initialDraft?.location) return;
    let cancelled = false;
    (async () => {
      const ctrl = new AbortController();
      const results = await combinedSearch(initialDraft.locationQuery!, ctrl.signal);
      if (cancelled) return;
      if (results[0]) {
        const r = results[0];
        setPicked(r);
        setQuery(r.label);
        setLatlng({ lat: r.lat, lng: r.lng });
      }
    })().catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const isDesktop = useIsDesktop();
  const [existingCards, setExistingCards] = useState<Card[]>([]);
  useEffect(() => {
    if (!isDesktop) return;
    fetchActiveCards().then(setExistingCards).catch(() => {});
  }, [isDesktop]);

  // ====== derived values ======

  // The picker works in Paris wall-clock. We seed the day from parisNow()
  // (whose local fields already mirror Paris), then reinterpret the chosen
  // wall-clock as a real Paris instant via wallClockToParisMs. This keeps
  // "tomorrow 15:00" meaning 15:00 in Paris for every visitor, not just
  // those whose browser sits in CET.
  const startsAt = useMemo<Date | null>(() => {
    let d: Date | null = null;
    if (dayMode === "today") d = parisNow();
    else if (dayMode === "tomorrow") { d = parisNow(); d.setDate(d.getDate() + 1); }
    else if (dayMode === "custom" && customDate) {
      const [y, m, dd] = customDate.split("-").map(Number);
      d = parisNow();
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

    // d now carries Paris wall-clock in its local fields → convert to the
    // true instant for that Paris time.
    return new Date(wallClockToParisMs(d));
  }, [dayMode, customDate, hour, customHM]);

  // Computed end timestamp from startsAt + endsMode (+ customEndHM).
  // `null` means "open-ended" (no end time).
  const endsAt = useMemo<Date | null>(() => {
    if (!startsAt || !endsMode || endsMode === "open") return null;
    // Relative durations are pure instant math — timezone-safe.
    if (endsMode === "1h") return new Date(startsAt.getTime() + 60 * 60_000);
    if (endsMode === "2h") return new Date(startsAt.getTime() + 120 * 60_000);
    if (endsMode === "3h") return new Date(startsAt.getTime() + 180 * 60_000);
    // Absolute end times anchor to the Paris calendar day of the start.
    const p = parisParts(startsAt.getTime());
    if (endsMode === "evening") {
      const ms = parisWallTimeToMs(p.y, p.mo, p.d, 23, 0);
      return ms > startsAt.getTime() ? new Date(ms) : null;
    }
    if (endsMode === "custom" && customEndHM) {
      const [hh, mm] = customEndHM.split(":").map(Number);
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        let ms = parisWallTimeToMs(p.y, p.mo, p.d, hh, mm);
        if (ms <= startsAt.getTime()) ms += 24 * 60 * 60_000; // next day
        return new Date(ms);
      }
    }
    return null;
  }, [startsAt, endsMode, customEndHM]);

  const hourChips = useMemo(() => {
    const base = [11, 13, 15, 17, 18, 19, 20, 21, 22];
    if (dayMode !== "today") return base;
    const min = parisNow().getHours() + 1;
    return base.filter((h) => h >= min);
  }, [dayMode]);

  const customDayLabel = useMemo(() => {
    if (!customDate) return "";
    const d = new Date(customDate + "T00:00:00");
    return d
      .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
      .toUpperCase();
  }, [customDate]);

  const todayValue = useMemo(() => isoDate(parisNow()), []);

  const previewColor = useMemo(
    () => cardColor({ color, title }),
    [color, title],
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
        if (results.length) setSuggestOpen(true);
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
    setSuggestOpen(false);
    confirm("locationQuery");
  }

  // Keep exactly what the user typed as the label (escape hatch when no
  // suggestion is specific enough) and let them drop the pin on the map.
  function keepTypedLocation() {
    setSuggestOpen(false);
    confirm("locationQuery");
  }

  // A self-contained, dismissible location field — used in both the desktop
  // sidebar and the mobile composer so behaviour stays identical.
  function renderLocationField() {
    const typed = query.trim();
    return (
      <div>
        <label className="mono text-[10px] tracking-widest opacity-70">
          LOCATION
          {searching && <span className="ml-2 opacity-60">SEARCHING…</span>}
        </label>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPicked(null); setSuggestOpen(true); confirm("locationQuery"); }}
            onFocus={() => { if (suggestions.length) setSuggestOpen(true); }}
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setSuggestOpen(false); } }}
            onBlur={() => window.setTimeout(() => setSuggestOpen(false), 140)}
            placeholder="Search a place — or just click the map"
            className="input mt-1"
          />
          {suggestOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-paper border border-rule rounded-xl z-20 max-h-72 overflow-y-auto shadow-lg">
              {/* dismiss bar */}
              <div className="sticky top-0 flex items-center justify-between bg-paper border-b border-rule px-3 py-1.5">
                <span className="mono text-[9px] tracking-widest opacity-50">
                  {suggestions.length} NEARBY
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSuggestOpen(false)}
                  className="mono text-[9px] tracking-widest opacity-60 hover:opacity-100"
                  aria-label="Close suggestions"
                >
                  CLOSE ✕
                </button>
              </div>
              {suggestions.map((s, i) => (
                <button
                  key={`${s.label}-${s.lat}-${s.lng}-${i}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickLocation(s)}
                  className="block w-full text-left px-3 py-2 hover:bg-ink hover:text-paper border-b border-rule"
                >
                  <div className="font-medium text-[13px] leading-tight truncate">{s.label}</div>
                  <div className="mono text-[9px] tracking-widest opacity-60 mt-0.5 truncate">
                    {s.source === "quartier" ? "◆ " : "● "}
                    {s.hint || "PARIS"}
                  </div>
                </button>
              ))}
              {/* escape hatch: nothing fits → keep my text, pin on the map */}
              {typed.length > 1 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={keepTypedLocation}
                  className="block w-full text-left px-3 py-2 bg-ink/[0.03] hover:bg-ink hover:text-paper"
                >
                  <div className="mono text-[10px] tracking-widest">
                    USE &ldquo;{typed.length > 28 ? typed.slice(0, 26) + "…" : typed}&rdquo;
                  </div>
                  <div className="mono text-[9px] tracking-widest opacity-60 mt-0.5">
                    + DROP THE PIN ON THE MAP
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
        {latlng ? (
          <div className="mono text-[10px] mt-2 opacity-70">
            PIN · {latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)}
            {picked?.hint ? ` · ${picked.hint}` : ""}
          </div>
        ) : (
          <p className="mono text-[10px] mt-1 opacity-50">
            Pick a suggestion, or click the map to drop the pin.
          </p>
        )}
      </div>
    );
  }

  // ====== submit ======

  async function submit() {
    if (!title.trim() || !latlng || !startsAt || spots === null) return;
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
          tags,
          color,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt ? endsAt.toISOString() : null,
          modules: draftModule ? [draftModule] : [],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to post");
        return;
      }
      onClose();
      // ?new=1 tells the detail page to show a "✓ THING POSTED" confirmation.
      router.push(`/post/${json.id}?new=1`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !!title.trim() &&
    !!latlng &&
    !!startsAt &&
    spots !== null &&
    !submitting;

  // Build a human-readable list of what's still missing for the POST button.
  // Empty when the form is ready. Used to render a gentle hint under the
  // disabled POST so the user knows exactly what's left. Permission has a
  // sensible default ("public") so it's never blocking.
  const missing = [
    !title.trim() && "TITLE",
    !startsAt && "WHEN",
    !latlng && "LOCATION",
    spots === null && "PEOPLE",
  ].filter(Boolean) as string[];
  const chipBase = "px-3.5 py-2 rounded-full border border-rule-strong mono text-[10px] tracking-widest transition-colors";

  const kindHeader = (
    <div className="mono text-[10px] tracking-widest opacity-70">NEW · ONE THING</div>
  );

  // Top-bar carries optional "back to AI prompt" + CLOSE.
  const topBarRight = (
    <div className="flex items-center gap-3">
      {onBack && (
        <button
          onClick={onBack}
          className="mono text-[11px] tracking-widest hover:underline"
        >
          ← BACK
        </button>
      )}
      <button onClick={onClose} className="mono text-[11px] tracking-widest hover:underline">
        CLOSE ✕
      </button>
    </div>
  );

  // Reusable colour-picker pill that sits inside the preview banner.
  const colorPickerInBanner = (
    <div className="absolute bottom-3 right-3 z-20">
      <button
        type="button"
        onClick={() => setColorOpen((o) => !o)}
        className={`mono text-[10px] tracking-widest px-2.5 py-1 border transition flex items-center gap-1.5 ${
          previewDark
            ? "border-paper/60 text-paper bg-ink/30 hover:bg-paper hover:text-ink"
            : "border-rule-strong/60 text-ink bg-paper/40 hover:bg-ink hover:text-paper"
        }`}
        aria-label="Pick a color"
      >
        <span className="block w-2.5 h-2.5 border border-current rounded-full" />
        COLOR
      </button>
      {colorOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-paper border border-rule rounded-xl p-2 w-[208px] animate-fadeIn shadow-lg">
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
                  className={`w-7 h-7 border ${active ? "border-rule-strong ring-2 ring-ink ring-offset-1 ring-offset-paper" : "border-rule-strong/20 hover:border-rule-strong"}`}
                  style={{ backgroundColor: c.value }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 mono text-[10px] tracking-widest">
            <label className="flex items-center gap-2 cursor-pointer text-ink">
              <input
                type="color"
                value={color || "#0a0a0a"}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 rounded-lg border border-rule-strong p-0 cursor-pointer bg-paper"
              />
              CUSTOM
            </label>
            {color && (
              <button
                type="button"
                onClick={() => { setColor(null); setColorOpen(false); }}
                className="hover:underline text-ink"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Picked-pin colors mirror the live preview. Inner = explicit color (or
  // white while nothing is picked yet), outer = ink for a steady editorial
  // ring against any background.
  const pickedInner = color || "#ffffff";
  const pickedOuter = "#0a0a0a";

  // Desktop side-panel: full Paris map on the left, configurator on the right.
  if (isDesktop) {
    return (
      <div className="h-full w-full flex bg-paper">
        {/* main map */}
        <div className="flex-1 relative min-w-0">
          <ParisMap
            cards={existingCards}
            selectable
            pickedLatLng={latlng}
            pickedColors={{ inner: pickedInner, outer: pickedOuter }}
            onPick={(ll) => {
              setLatlng(ll);
              setPicked(null);
              if (!query) setQuery("Custom pin");
              confirm("locationQuery");
              setSuggestOpen(false);
            }}
            gestureHandling={false}
          />
          <div
            className="absolute left-3 z-[1100] mono text-[10px] tracking-widest bg-paper/90 backdrop-blur border border-rule rounded-full px-3 py-1.5 shadow-sm max-w-[calc(100%-24px)] truncate"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            {latlng
              ? `PIN · ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)} · CLICK TO MOVE`
              : "CLICK / TAP THE MAP TO DROP YOUR PIN"}
          </div>
        </div>

        {/* sidebar */}
        <aside className="w-[420px] shrink-0 flex flex-col border-l border-rule-strong bg-paper">
          <div className="relative flex items-center justify-between border-b border-rule-strong px-4 py-4 shrink-0">
            {kindHeader}
            {topBarRight}
          </div>

          {/* preview banner */}
          <div
            className="relative h-36 transition-colors duration-300 shrink-0"
            style={{ backgroundColor: previewColor }}
          >
            <div className="h-full flex flex-col justify-end p-4 pr-24">
              <div
                className={`mono text-[10px] tracking-widest px-2.5 py-1 rounded-full inline-block self-start ${previewDark ? "bg-white/90 text-ink" : "bg-ink/90 text-paper"}`}
              >
                LIVE PREVIEW
              </div>
              <div
                className={`editorial font-black text-[17px] sm:text-[18px] mt-2 leading-[1.15] line-clamp-2 pb-0.5 ${previewDark ? "text-paper" : "text-ink"}`}
              >
                {title || "What's your one thing this week?"}
              </div>
            </div>
            {colorPickerInBanner}
          </div>

          {/* form body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-5">
            {/* TITLE */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">TITLE{inferredHint("title")}</label>
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); confirm("title"); }}
                placeholder="A film night about loneliness. Sunday, my place."
                className="input mt-1"
                maxLength={140}
              />
            </div>

            {/* TAGS */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">TAGS <span className="opacity-50">(OPTIONAL)</span>{inferredHint("tags")}</label>
              <TagInput
                value={tags}
                onChange={(v) => { setTags(v); confirm("tags"); }}
                max={5}
                suggestions={TAG_SUGGESTIONS}
                placeholder="e.g. fashion, shooting"
                className="mt-1"
              />
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">DESCRIPTION <span className="opacity-50">(OPTIONAL)</span>{inferredHint("description")}</label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); confirm("description"); }}
                rows={3}
                placeholder="A few sentences. Who is this for. What kind of energy."
                className="input mt-1 resize-none"
                maxLength={500}
              />
            </div>

            {/* PEOPLE */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">PEOPLE{inferredHint("spots")}</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {SPOT_CHIPS.map((n) => {
                  const active = !spotsCustom && spots === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setSpots(n); setSpotsCustom(false); confirm("spots"); }}
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
                    value={spots ?? ""}
                    onChange={(e) => {
                      setSpots(Math.max(1, Math.min(99, Number(e.target.value) || 1)));
                      confirm("spots");
                    }}
                    className="input w-20 tabular-nums"
                    autoFocus
                  />
                )}
              </div>
            </div>

            {/* WHEN */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">
                WHEN DOES IT START?{inferredHint("startsAtIso")}
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
                        confirm("startsAtIso");
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
                  onChange={(e) => { setCustomDate(e.target.value); setHour(null); setCustomHM(""); confirm("startsAtIso"); }}
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
                          onClick={() => { setHour(h); setCustomHM(""); setShowCustomTime(false); confirm("startsAtIso"); }}
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
                        onChange={(e) => { setCustomHM(e.target.value); setHour(null); confirm("startsAtIso"); }}
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

            {/* DURATION — only relevant once a start time exists */}
            {startsAt && (
              <div>
                <label className="mono text-[10px] tracking-widest opacity-70">
                  HOW LONG? <span className="opacity-50">(OPTIONAL)</span>{inferredHint("endsAtIso")}
                </label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {ENDS_CHIPS.map(({ mode, label: l }) => {
                    const active = endsMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setEndsMode(mode);
                          if (mode !== "custom") setCustomEndHM("");
                          confirm("endsAtIso");
                        }}
                        className={`${chipBase} ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                      >
                        {l}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => { setEndsMode("custom"); confirm("endsAtIso"); }}
                    className={`${chipBase} ${endsMode === "custom" ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                  >
                    + CUSTOM
                  </button>
                  {endsMode === "custom" && (
                    <input
                      type="time"
                      autoFocus
                      value={customEndHM}
                      onChange={(e) => { setCustomEndHM(e.target.value); confirm("endsAtIso"); }}
                      className="input w-28 animate-fadeIn"
                      placeholder="HH:MM"
                    />
                  )}
                </div>
                {endsAt && endsMode !== "open" && (
                  <p className="mono text-[10px] mt-2 opacity-70 tabular-nums">
                    ENDS · {parisClockLabel(endsAt.getTime())}
                  </p>
                )}
                {endsMode === "open" && (
                  <p className="mono text-[10px] mt-2 opacity-60">
                    OPEN-ENDED · NO FIXED END TIME
                  </p>
                )}
              </div>
            )}

            {/* PERMISSION */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">JOIN PERMISSION{inferredHint("permission")}</label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPermission("public"); confirm("permission"); }}
                  className={`flex-1 px-3 py-2 rounded-full border mono text-[10px] tracking-widest transition-colors ${permission === "public" ? "bg-ink text-paper border-ink" : "bg-paper border-rule-strong hover:border-ink"}`}
                >
                  PUBLIC JOIN
                </button>
                <button
                  type="button"
                  onClick={() => { setPermission("request"); confirm("permission"); }}
                  className={`flex-1 px-3 py-2 rounded-full border mono text-[10px] tracking-widest transition-colors ${permission === "request" ? "bg-ink text-paper border-ink" : "bg-paper border-rule-strong hover:border-ink"}`}
                >
                  REQUEST TO JOIN
                </button>
              </div>
            </div>

            {/* LOCATION — search OR click on the map */}
            {renderLocationField()}

            {/* MODULE — optional draft module for this thing.
                Reflist replaces the old single-link affordance. */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">
                MODULE <span className="opacity-50">(OPTIONAL)</span>
              </label>
              <div className="mt-2">
                <ModuleDraftPicker
                  value={draftModule}
                  onChange={setDraftModule}
                  context={{ title, description, tags }}
                />
              </div>
              <p className="mono text-[10px] mt-2 opacity-50">
                A brief, a roadmap, a moodboard… pick the one shape that
                helps this thing land. AI suggestions become available
                once it's posted.
              </p>
            </div>

            {error && (
              <p className="mono text-[11px] text-red-700">{error.toUpperCase()}</p>
            )}
          </div>

          {/* action bar */}
          <div
            className="border-t border-rule-strong px-4 py-3 shrink-0"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            {missing.length > 0 && (
              <p className="mono text-[10px] opacity-60 mb-2">
                STILL NEEDED · {missing.join(" · ")}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="btn ghost" disabled={submitting}>Cancel</button>
              <button
                onClick={submit}
                disabled={!canSubmit}
                className={`btn ${!canSubmit ? "opacity-40" : ""}`}
              >
                {submitting ? "Posting…" : "Post →"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex sm:items-center sm:justify-center sm:bg-ink/60 sm:p-6">
      <div className="bg-paper flex flex-col w-full h-full sm:max-w-[1100px] sm:max-h-[90vh] sm:h-auto sm:rounded-2xl sm:border sm:border-rule sm:shadow-lg sm:overflow-hidden">
      <div
        className="relative flex items-center justify-between border-b border-rule-strong px-4 sm:px-6 py-3 sm:py-4 shrink-0 safe-top"
      >
        {kindHeader}
        {topBarRight}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* solid color preview */}
        <div
          className="relative h-40 sm:h-56 transition-colors duration-300"
          style={{ backgroundColor: previewColor }}
        >
          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 pr-24 sm:pr-28">
            <div
              className={`mono text-[10px] tracking-widest px-2.5 py-1 rounded-full inline-block self-start ${previewDark ? "bg-white/90 text-ink" : "bg-ink/90 text-paper"}`}
            >
              LIVE PREVIEW
            </div>
            <div
              className={`editorial font-black text-[22px] sm:text-[30px] mt-2 leading-[1.15] line-clamp-3 pb-1 ${previewDark ? "text-paper" : "text-ink"}`}
            >
              {title || "What's your one thing this week?"}
            </div>
          </div>
          {colorPickerInBanner}
        </div>

        <div className="px-4 sm:px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
          <div className="space-y-5">
            {/* TITLE */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">TITLE{inferredHint("title")}</label>
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); confirm("title"); }}
                placeholder="A film night about loneliness. Sunday, my place."
                className="input mt-1"
                maxLength={140}
              />
            </div>

            {/* TAGS */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">TAGS <span className="opacity-50">(OPTIONAL)</span>{inferredHint("tags")}</label>
              <TagInput
                value={tags}
                onChange={(v) => { setTags(v); confirm("tags"); }}
                max={5}
                suggestions={TAG_SUGGESTIONS}
                placeholder="e.g. fashion, shooting"
                className="mt-1"
              />
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">DESCRIPTION <span className="opacity-50">(OPTIONAL)</span>{inferredHint("description")}</label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); confirm("description"); }}
                rows={4}
                placeholder="A few sentences. Who is this for. What kind of energy."
                className="input mt-1 resize-none"
                maxLength={500}
              />
            </div>

            {/* PEOPLE */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">PEOPLE{inferredHint("spots")}</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {SPOT_CHIPS.map((n) => {
                  const active = !spotsCustom && spots === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setSpots(n); setSpotsCustom(false); confirm("spots"); }}
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
                    value={spots ?? ""}
                    onChange={(e) => {
                      setSpots(Math.max(1, Math.min(99, Number(e.target.value) || 1)));
                      confirm("spots");
                    }}
                    className="input w-20 tabular-nums"
                    autoFocus
                  />
                )}
              </div>
            </div>

            {/* WHEN — two stage */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">
                WHEN DOES IT START?{inferredHint("startsAtIso")}
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
                        confirm("startsAtIso");
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
                  onChange={(e) => { setCustomDate(e.target.value); setHour(null); setCustomHM(""); confirm("startsAtIso"); }}
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
                            confirm("startsAtIso");
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
                        onChange={(e) => { setCustomHM(e.target.value); setHour(null); confirm("startsAtIso"); }}
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

            {/* DURATION — mobile */}
            {startsAt && (
              <div>
                <label className="mono text-[10px] tracking-widest opacity-70">
                  HOW LONG? <span className="opacity-50">(OPTIONAL)</span>{inferredHint("endsAtIso")}
                </label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {ENDS_CHIPS.map(({ mode, label: l }) => {
                    const active = endsMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setEndsMode(mode);
                          if (mode !== "custom") setCustomEndHM("");
                          confirm("endsAtIso");
                        }}
                        className={`${chipBase} ${active ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                      >
                        {l}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => { setEndsMode("custom"); confirm("endsAtIso"); }}
                    className={`${chipBase} ${endsMode === "custom" ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper"}`}
                  >
                    + CUSTOM
                  </button>
                  {endsMode === "custom" && (
                    <input
                      type="time"
                      autoFocus
                      value={customEndHM}
                      onChange={(e) => { setCustomEndHM(e.target.value); confirm("endsAtIso"); }}
                      className="input w-28 animate-fadeIn"
                      placeholder="HH:MM"
                    />
                  )}
                </div>
                {endsAt && endsMode !== "open" && (
                  <p className="mono text-[10px] mt-2 opacity-70 tabular-nums">
                    ENDS · {parisClockLabel(endsAt.getTime())}
                  </p>
                )}
                {endsMode === "open" && (
                  <p className="mono text-[10px] mt-2 opacity-60">
                    OPEN-ENDED · NO FIXED END TIME
                  </p>
                )}
              </div>
            )}

            {/* JOIN PERMISSION */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">JOIN PERMISSION{inferredHint("permission")}</label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPermission("public"); confirm("permission"); }}
                  className={`flex-1 px-3 py-2 rounded-full border mono text-[10px] tracking-widest transition-colors ${permission === "public" ? "bg-ink text-paper border-ink" : "bg-paper border-rule-strong hover:border-ink"}`}
                >
                  PUBLIC JOIN
                </button>
                <button
                  type="button"
                  onClick={() => { setPermission("request"); confirm("permission"); }}
                  className={`flex-1 px-3 py-2 rounded-full border mono text-[10px] tracking-widest transition-colors ${permission === "request" ? "bg-ink text-paper border-ink" : "bg-paper border-rule-strong hover:border-ink"}`}
                >
                  REQUEST TO JOIN
                </button>
              </div>
            </div>

            {/* LOCATION */}
            {renderLocationField()}

            {/* MODULE — optional draft module for this thing.
                Reflist replaces the old single-link affordance. */}
            <div>
              <label className="mono text-[10px] tracking-widest opacity-70">
                MODULE <span className="opacity-50">(OPTIONAL)</span>
              </label>
              <div className="mt-2">
                <ModuleDraftPicker
                  value={draftModule}
                  onChange={setDraftModule}
                  context={{ title, description, tags }}
                />
              </div>
              <p className="mono text-[10px] mt-2 opacity-50">
                A brief, a roadmap, a moodboard… pick the one shape that
                helps this thing land. AI suggestions become available
                once it's posted.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="mono text-[10px] tracking-widest opacity-70">PIN ON MAP</label>
            <div className="rounded-2xl overflow-hidden border border-rule shadow-sm h-[460px] sm:h-[520px]">
              <ParisMap
                cards={[]}
                selectable
                pickedLatLng={latlng}
                pickedColors={{ inner: pickedInner, outer: pickedOuter }}
                onPick={(ll) => {
                  setLatlng(ll);
                  setPicked(null);
                  if (!query) setQuery("Custom pin");
                  confirm("locationQuery");
              setSuggestOpen(false);
                }}
              />
            </div>
            <p className="mono text-[10px] opacity-60">
              CLICK / TAP THE MAP TO DROP A PIN. DRAG TO ADJUST.
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 border-t border-rule-strong mono text-[11px] bg-ink text-paper">
          ONE LIVE CARD PER PERSON — POSTING AUTO-ARCHIVES YOUR CURRENT ONE (IF ANY) INTO YOUR CARNET.
        </div>
        {error && (
          <div className="px-4 sm:px-6 py-3 mono text-[11px] text-red-700">
            {error.toUpperCase()}
          </div>
        )}
      </div>

      <div
        className="border-t border-rule-strong px-4 sm:px-6 py-3 shrink-0"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        {missing.length > 0 && (
          <p className="mono text-[10px] opacity-60 mb-2">
            STILL NEEDED · {missing.join(" · ")}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
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
    </div>
  );
}
