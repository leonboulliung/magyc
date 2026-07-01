"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ClarifyPrefill, Module } from "@/lib/types";
import { MapCanvas, OSM_TILES } from "@/components/widgets/MapCanvas";

/**
 * ClarifyModuleStep — renders the interactive editor for one prefilled
 * module during the clarify flow, and reports the user's configured
 * Module (or null if they leave it unset / skip).
 *
 * This is the GENERAL mechanism: a registry keyed by module type. The
 * map and phases editors below are the first two; adding another module
 * to the prefill set is just another editor here.
 */
export function ClarifyModuleStep({
  prefill,
  value,
  onChange,
}: {
  prefill: ClarifyPrefill;
  value: Module | null;
  onChange: (m: Module | null) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="mono text-[10px] tracking-widest opacity-30">
        {prefill.reason || prefill.type.replace("_", " ")}
      </p>

      {prefill.type === "location_single" && (
        <LocationEditor draft={prefill.draft} value={value} onChange={onChange} />
      )}
      {prefill.type === "locations_multi" && (
        <MultiPointEditor mode="multi" draft={prefill.draft} value={value} onChange={onChange} />
      )}
      {prefill.type === "route" && (
        <MultiPointEditor mode="route" draft={prefill.draft} value={value} onChange={onChange} />
      )}
      {prefill.type === "phases" && (
        <PhasesEditor draft={prefill.draft} value={value} onChange={onChange} />
      )}
      {prefill.type === "date" && (
        <DateEditor draft={prefill.draft} value={value} onChange={onChange} />
      )}
    </div>
  );
}

// ── Location editor — search + mini map + pin ─────────────────────────

interface GeoMatch { label: string; lng: number; lat: number; }

function LocationEditor({
  draft,
  value,
  onChange,
}: {
  draft: Record<string, unknown>;
  value: Module | null;
  onChange: (m: Module | null) => void;
}) {
  const initialLabel =
    value && value.type === "location_single" ? (value.label ?? "") :
    typeof draft.label === "string" ? draft.label :
    typeof draft.query === "string" ? draft.query : "";

  const initialSel: GeoMatch | null =
    value && value.type === "location_single"
      ? { lng: value.center[0], lat: value.center[1], label: value.label ?? "" }
      : null;

  const [query, setQuery] = useState(initialLabel);
  const [results, setResults] = useState<GeoMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GeoMatch | null>(initialSel);
  const [mapVersion, setMapVersion] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<GeoMatch | null>(initialSel);

  const emit = useCallback((s: GeoMatch | null) => {
    selectedRef.current = s;
    onChange(s ? { type: "location_single", center: [s.lng, s.lat], zoom: 14, label: s.label } : null);
  }, [onChange]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json().catch(() => ({ results: [] }));
      setResults(Array.isArray(json.results) ? json.results.slice(0, 5) : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // If the AI gave a draft query and nothing is selected yet, try to
  // resolve it once so the map starts on a sensible guess.
  useEffect(() => {
    if (!initialSel && typeof draft.query === "string" && draft.query.trim()) {
      runSearch(draft.query).then(() => {/* results shown; user picks */});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onQueryChange(v: string) {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(v), 350);
  }

  function pick(m: GeoMatch) {
    setSelected(m);
    setResults([]);
    setQuery(m.label);
    setMapVersion((v) => v + 1);
    emit(m);
  }

  return (
    <div className="space-y-3">
      {/* Search field */}
      <div className="relative">
        <input
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Ort oder Adresse suchen"
          className="w-full text-[16px] px-3 py-2.5 rounded-[var(--v-radius)] bg-transparent outline-none"
          style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 mono text-[11px] opacity-40">…</span>
        )}

        {/* Results dropdown */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 right-0 top-full mt-1 z-20 overflow-hidden rounded-[var(--v-radius)]"
              style={{
                border: "1px solid var(--v-rule)",
                background: "var(--v-bg)",
                color: "var(--v-fg)",
                boxShadow: "0 18px 50px rgba(0,0,0,0.12)",
                backdropFilter: "blur(18px)",
              }}
            >
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-black/[0.04]"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Mini map with the picked pin (draggable) */}
      {selected && (
        <div className="rounded-[var(--v-radius)] overflow-hidden" style={{ border: "1px solid var(--v-rule)" }}>
          <MapCanvas
            height={180}
            deps={[mapVersion]}
            setup={(L, el) => {
              const s = selectedRef.current!;
              const map = L.map(el, { scrollWheelZoom: false, zoomControl: false, attributionControl: false })
                .setView([s.lat, s.lng], 14);
              L.tileLayer(OSM_TILES, { maxZoom: 19 }).addTo(map);
              const icon = L.divIcon({
                html: `<div style="width:14px;height:14px;border-radius:50%;background:#0d0d0d;border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.25);"></div>`,
                className: "", iconSize: [14, 14], iconAnchor: [7, 7],
              });
              const marker = L.marker([s.lat, s.lng], { icon, draggable: true }).addTo(map);
              marker.on("dragend", (e) => {
                const p = (e.target as L.Marker).getLatLng();
                const next = { ...selectedRef.current!, lng: p.lng, lat: p.lat };
                setSelected(next);
                emit(next); // update output without rebuilding the map
              });
              map.on("click", (e: L.LeafletMouseEvent) => {
                marker.setLatLng(e.latlng);
                const next = { ...selectedRef.current!, lng: e.latlng.lng, lat: e.latlng.lat };
                setSelected(next);
                emit(next);
              });
              return () => map.remove();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Multi-point editor — locations_multi & route ─────────────────────
// One editor for both: a search that appends real places to a list, a
// map showing every pin (a connecting line + ordering for routes), and
// remove / reorder controls. The model can't pin places reliably — this
// is exactly the clarify modality that keeps it from guessing.

function MultiPointEditor({
  mode,
  draft,
  value,
  onChange,
}: {
  mode: "route" | "multi";
  draft: Record<string, unknown>;
  value: Module | null;
  onChange: (m: Module | null) => void;
}) {
  const seed = (): GeoMatch[] => {
    if (value && value.type === "route") return value.stops.map((s) => ({ lng: s.lng, lat: s.lat, label: s.label ?? "" }));
    if (value && value.type === "locations_multi") return value.locations.map((s) => ({ lng: s.lng, lat: s.lat, label: s.label ?? "" }));
    return [];
  };

  const [points, setPoints] = useState<GeoMatch[]>(seed);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointsRef = useRef<GeoMatch[]>(points);
  pointsRef.current = points;

  const emit = useCallback((list: GeoMatch[]) => {
    const pts = list.map((p) => ({ lng: p.lng, lat: p.lat, label: p.label }));
    if (mode === "route") {
      onChange(pts.length >= 2 ? { type: "route", stops: pts } : null);
    } else {
      onChange(pts.length >= 1 ? { type: "locations_multi", locations: pts } : null);
    }
  }, [mode, onChange]);

  function update(next: GeoMatch[]) {
    setPoints(next);
    setMapVersion((v) => v + 1);
    emit(next);
  }

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json().catch(() => ({ results: [] }));
      setResults(Array.isArray(json.results) ? json.results.slice(0, 5) : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function onQueryChange(v: string) {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(v), 350);
  }

  function add(m: GeoMatch) {
    update([...pointsRef.current, m]);
    setQuery("");
    setResults([]);
  }
  function remove(i: number) { update(points.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= points.length) return;
    const next = [...points];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  }

  // Resolve the AI's draft place names once so the user starts with the
  // suggested stops already pinned (then refines).
  useEffect(() => {
    if (points.length > 0) return;
    const queries = Array.isArray(draft.queries)
      ? (draft.queries as unknown[]).filter((q): q is string => typeof q === "string" && q.trim().length > 1)
      : [];
    if (queries.length === 0) return;
    let cancelled = false;
    (async () => {
      const resolved: GeoMatch[] = [];
      for (const q of queries.slice(0, 8)) {
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
          const json = await res.json().catch(() => ({ results: [] }));
          const first = Array.isArray(json.results) ? json.results[0] : null;
          if (first) resolved.push(first);
        } catch { /* skip unresolvable */ }
      }
      if (!cancelled && resolved.length) update(resolved);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      {/* Search field */}
      <div className="relative">
        <input
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Weiteren Ort suchen"
          className="w-full text-[16px] px-3 py-2.5 rounded-[var(--v-radius)] bg-transparent outline-none"
          style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 mono text-[11px] opacity-40">…</span>
        )}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 right-0 top-full mt-1 z-20 overflow-hidden rounded-[var(--v-radius)]"
              style={{
                border: "1px solid var(--v-rule)",
                background: "var(--v-bg)",
                color: "var(--v-fg)",
                boxShadow: "0 18px 50px rgba(0,0,0,0.12)",
                backdropFilter: "blur(18px)",
              }}
            >
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => add(r)}
                    className="w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-black/[0.04]"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Chosen points */}
      {points.length > 0 && (
        <ol className="space-y-1.5">
          {points.map((p, i) => (
            <li key={`${p.lng},${p.lat},${i}`} className="flex items-center gap-2">
              <span className="mono text-[11px] tabular-nums opacity-40 w-5 shrink-0 text-center">
                {mode === "route" ? i + 1 : "•"}
              </span>
              <span className="flex-1 text-[14px] truncate">{p.label}</span>
              {mode === "route" && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="mono text-[12px] px-1 opacity-40 hover:opacity-90 disabled:opacity-15">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === points.length - 1} className="mono text-[12px] px-1 opacity-40 hover:opacity-90 disabled:opacity-15">↓</button>
                </div>
              )}
              <button type="button" onClick={() => remove(i)} className="mono text-[13px] px-1.5 opacity-40 hover:opacity-90 shrink-0">×</button>
            </li>
          ))}
        </ol>
      )}

      {/* Map with all pins (+ route line) */}
      {points.length > 0 && (
        <div className="rounded-[var(--v-radius)] overflow-hidden" style={{ border: "1px solid var(--v-rule)" }}>
          <MapCanvas
            height={180}
            deps={[mapVersion]}
            setup={(L, el) => {
              const pts = pointsRef.current;
              const map = L.map(el, { scrollWheelZoom: false, zoomControl: false, attributionControl: false });
              L.tileLayer(OSM_TILES, { maxZoom: 19 }).addTo(map);
              const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
              pts.forEach((p, i) => {
                const inner = mode === "route" ? `<span style="color:#fff;font-size:9px;font-weight:600;line-height:18px;">${i + 1}</span>` : "";
                const icon = L.divIcon({
                  html: `<div style="width:18px;height:18px;border-radius:50%;background:#0d0d0d;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.25);text-align:center;">${inner}</div>`,
                  className: "", iconSize: [18, 18], iconAnchor: [9, 9],
                });
                L.marker([p.lat, p.lng], { icon }).addTo(map);
              });
              if (mode === "route" && latlngs.length >= 2) {
                L.polyline(latlngs, { color: "#0d0d0d", weight: 2, opacity: 0.55 }).addTo(map);
              }
              if (latlngs.length === 1) map.setView(latlngs[0], 13);
              else if (latlngs.length > 1) map.fitBounds(latlngs, { padding: [28, 28] });
              return () => map.remove();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Phases editor — editable ordered list ─────────────────────────────

interface PhaseItem { label: string; description?: string; }

function PhasesEditor({
  draft,
  value,
  onChange,
}: {
  draft: Record<string, unknown>;
  value: Module | null;
  onChange: (m: Module | null) => void;
}) {
  const seed: PhaseItem[] =
    value && value.type === "phases"
      ? value.phases
      : Array.isArray(draft.phases)
        ? (draft.phases as unknown[])
            .map((p) => {
              const r = p as Record<string, unknown>;
              return { label: typeof r?.label === "string" ? r.label : "", description: typeof r?.description === "string" ? r.description : undefined };
            })
            .filter((p) => p.label)
        : [];

  const [phases, setPhases] = useState<PhaseItem[]>(seed.length ? seed : [{ label: "" }]);

  const emit = useCallback((list: PhaseItem[]) => {
    const clean = list.filter((p) => p.label.trim());
    onChange(clean.length >= 2 ? { type: "phases", phases: clean, currentPhase: 0 } : null);
  }, [onChange]);

  // Emit once on mount with the seed.
  useEffect(() => { emit(phases); /* eslint-disable-next-line */ }, []);

  function update(next: PhaseItem[]) { setPhases(next); emit(next); }
  function setLabel(i: number, v: string) { update(phases.map((p, idx) => idx === i ? { ...p, label: v } : p)); }
  function add() { update([...phases, { label: "" }]); }
  function remove(i: number) { update(phases.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= phases.length) return;
    const next = [...phases];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  }

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {phases.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="mono text-[11px] tabular-nums opacity-40 w-5 shrink-0">{i + 1}</span>
            <input
              value={p.label}
              onChange={(e) => setLabel(i, e.target.value)}
              placeholder="Phase benennen"
              maxLength={80}
              className="flex-1 text-[15px] px-3 py-2 rounded-[var(--v-radius)] bg-transparent outline-none"
              style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
            />
            <div className="flex items-center gap-0.5 shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="mono text-[12px] px-1.5 opacity-40 hover:opacity-90 disabled:opacity-15">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === phases.length - 1} className="mono text-[12px] px-1.5 opacity-40 hover:opacity-90 disabled:opacity-15">↓</button>
              <button type="button" onClick={() => remove(i)} className="mono text-[13px] px-1.5 opacity-40 hover:opacity-90">×</button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={add}
        className="mono text-[10px] tracking-widest px-3 py-1.5 rounded-full opacity-50 hover:opacity-100"
        style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
      >
        + Phase hinzufügen
      </button>
    </div>
  );
}

// ── Date editor — a single date ───────────────────────────────────────

function DateEditor({
  draft,
  value,
  onChange,
}: {
  draft: Record<string, unknown>;
  value: Module | null;
  onChange: (m: Module | null) => void;
}) {
  const initial =
    value && value.type === "date" ? value.date :
    typeof draft.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : "";
  const [date, setDate] = useState(initial);

  useEffect(() => {
    if (initial) onChange({ type: "date", date: initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      type="date"
      value={date}
      onChange={(e) => {
        setDate(e.target.value);
        onChange(e.target.value ? { type: "date", date: e.target.value } : null);
      }}
      className="text-[16px] px-3 py-2.5 rounded-[var(--v-radius)] bg-transparent outline-none"
      style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
    />
  );
}
