"use client";

import { useEffect, useRef, useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { LocationSingleWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { MapCanvas, OSM_TILES } from "./MapCanvas";

/**
 * Eine Location — single pinned map.
 *
 *   - Zoom: +/− buttons + double-click (scroll-wheel stays off so the
 *     map never hijacks page scroll).
 *   - Editable place: owner clicks the label → searches via /api/geocode
 *     → picks from a dropdown → the pin, view and label update.
 *   - Pin moves by dragging it or clicking the map; the label then
 *     reverse-geocodes to track the new spot.
 *
 * Persistence is SILENT (PUT without a full-space refetch): a pin drag
 * must not rebuild the map (which flashed it transparent) nor refetch
 * everything. The marker is already where the user put it; we just
 * write it through. The map only re-centres on an explicit search-pick.
 */
export function LocationSingleRenderer({
  module: m,
  index,
}: {
  module: LocationSingleWidget;
  index: number;
}) {
  const ctx = useWidgetContext();

  // View center drives the map's setView + the MapCanvas rebuild dep.
  // It changes ONLY on a search-pick (deliberate re-centre), never on a
  // pin drag — so dragging never tears the map down.
  const [view, setView] = useState<[number, number]>(m.center);
  const [label, setLabel] = useState(m.label || m.microTitle || "");
  const zoomRef = useRef(m.zoom ?? 13);

  // Re-sync if the module changes from outside (version switch, etc.).
  useEffect(() => {
    setView(m.center);
    setLabel(m.label || m.microTitle || "");
    zoomRef.current = m.zoom ?? 13;
  }, [m.center, m.label, m.microTitle, m.zoom]);

  /** Persist a change WITHOUT a full refetch. The map is already in the
   *  desired visual state locally; we only need the write to land. */
  async function persist(next: Partial<LocationSingleWidget>) {
    if (!ctx.isOwner) return;
    await ctx.saveModule(index, { ...m, ...next }, { quiet: true });
  }

  /** Pin moved: persist coords + relabel from reverse geocoding. Does
   *  NOT touch `view`, so the map is not rebuilt. */
  async function onPinMoved(lng: number, lat: number) {
    if (!ctx.isOwner) return;
    persist({ center: [lng, lat] });
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const json = await res.json().catch(() => ({}));
      if (typeof json.label === "string" && json.label) {
        setLabel(json.label);
        persist({ center: [lng, lat], label: json.label });
      }
    } catch { /* keep the old label */ }
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard
        microTitle={m.microTitle ?? label}
        description={m.description}
        attribution={m.attribution ?? { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", license: "ODbL" }}
        bare
      >
        <MapCanvas
          height={200}
          deps={[view[1], view[0], ctx.isOwner]}
          setup={(L, el) => {
            const [vLng, vLat] = view;
            const map = L.map(el, {
              scrollWheelZoom: false,
              zoomControl: true,
              doubleClickZoom: true,
              attributionControl: false,
            }).setView([vLat, vLng], zoomRef.current);
            map.zoomControl.setPosition("topright");
            L.tileLayer(OSM_TILES, { maxZoom: 19 }).addTo(map);

            const icon = L.divIcon({
              html: `<div style="
                width:14px;height:14px;border-radius:50%;
                background:var(--v-accent);
                border:2.5px solid #fff;
                box-shadow:0 1px 3px rgba(0,0,0,0.2);
              "></div>`,
              className: "",
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            });

            const marker = L.marker([vLat, vLng], { icon, draggable: ctx.isOwner }).addTo(map);

            if (ctx.isOwner) {
              marker.on("dragend", (e) => {
                const p = (e.target as L.Marker).getLatLng();
                onPinMoved(p.lng, p.lat);
              });
              map.on("click", (e: L.LeafletMouseEvent) => {
                marker.setLatLng(e.latlng);
                onPinMoved(e.latlng.lng, e.latlng.lat);
              });
              map.on("zoomend", () => {
                const z = map.getZoom();
                if (z !== zoomRef.current) { zoomRef.current = z; persist({ zoom: z }); }
              });
            }

            return () => map.remove();
          }}
        />

        <LocationLabel
          label={label}
          isOwner={ctx.isOwner}
          onPick={(match) => {
            setLabel(match.label);
            setView([match.lng, match.lat]); // deliberate re-centre
            persist({ center: [match.lng, match.lat], label: match.label });
          }}
        />
      </WidgetCard>
    </WidgetShell>
  );
}

interface GeoMatch {
  label: string;
  lng: number;
  lat: number;
}

/**
 * Editable place label with geocode autocomplete. Read-only mono text
 * until the owner clicks it; then a search input with a debounced
 * dropdown of real place matches.
 */
function LocationLabel({
  label,
  isOwner,
  onPick,
}: {
  label: string;
  isOwner: boolean;
  onPick: (match: GeoMatch) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState(label);
  const [results, setResults] = useState<GeoMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function onChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(v.trim())}`);
        const json = await res.json().catch(() => ({ results: [] }));
        setResults(Array.isArray(json.results) ? json.results : []);
      } finally {
        setLoading(false);
      }
    }, 320);
  }

  function pick(match: GeoMatch) {
    onPick(match);
    setEditing(false);
    setResults([]);
    setQuery(match.label);
  }

  if (!label && !isOwner) return null;

  return (
    <div className="relative px-4 py-3">
      {editing ? (
        <>
          <div className="flex items-center gap-2">
            <span aria-hidden className="mono text-[11px] opacity-40" style={{ color: "var(--v-fg)" }}>⊙</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setEditing(false); setQuery(label); setResults([]); }
                else if (e.key === "Enter" && results[0]) pick(results[0]);
              }}
              onBlur={() => { setTimeout(() => setEditing(false), 150); }}
              placeholder="…"
              maxLength={120}
              className="flex-1 mono text-[11px] tracking-widest bg-transparent outline-none"
              style={{ color: "var(--v-fg)" }}
            />
            {loading && <span className="mono text-[11px] opacity-40">…</span>}
          </div>

          {results.length > 0 && (
            <div
              className="absolute left-3 right-3 top-full z-30 rounded-[var(--v-radius)] overflow-hidden"
              style={{ background: "var(--v-bg)", border: "1px solid var(--v-rule)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
            >
              {results.map((r, i) => (
                <button
                  key={`${r.lng},${r.lat},${i}`}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                  className="w-full text-left px-3 py-2 text-[12px] hover:bg-black/[0.04] transition-colors flex items-center gap-2"
                  style={{ color: "var(--v-fg)" }}
                >
                  <span aria-hidden className="opacity-40">⊙</span>
                  <span className="truncate">{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => { if (isOwner) { setQuery(label); setEditing(true); } }}
          disabled={!isOwner}
          className={`mono text-[11px] tracking-widest text-left ${isOwner ? "cursor-text hover:opacity-70" : "cursor-default"} transition-opacity`}
          style={{ color: "var(--v-fg)" }}
        >
          {label || "…"}
        </button>
      )}
    </div>
  );
}
