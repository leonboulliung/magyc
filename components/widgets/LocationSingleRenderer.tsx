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
 *     → picks from a dropdown → the pin + view + label update and PUT.
 *   - Pin can still be moved by dragging it or clicking the map.
 *
 * Attribution: OpenStreetMap / CARTO (shown in the card footer).
 */
export function LocationSingleRenderer({
  module: m,
  index,
}: {
  module: LocationSingleWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const [lng, lat] = m.center;
  const zoom = m.zoom ?? 13;

  async function persist(next: Partial<LocationSingleWidget>) {
    if (!ctx.isOwner) return;
    await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        widget: { ...m, ...next },
        anonOwnerToken: ctx.ownerToken,
      }),
    });
    ctx.refresh();
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard
        microTitle={m.microTitle ?? m.label}
        description={m.description}
        attribution={m.attribution ?? { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", license: "ODbL" }}
        bare
      >
        <MapCanvas
          height={200}
          deps={[lat, lng, zoom, ctx.isOwner]}
          setup={(L, el) => {
            const map = L.map(el, {
              scrollWheelZoom: false,
              zoomControl: true,
              doubleClickZoom: true,
              attributionControl: false,
            }).setView([lat, lng], zoom);
            map.zoomControl.setPosition("topright");
            L.tileLayer(OSM_TILES, { maxZoom: 19 }).addTo(map);

            // Accent (color2) pin — a soft dot, no heavy shadow.
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

            const marker = L.marker([lat, lng], { icon, draggable: ctx.isOwner }).addTo(map);

            if (ctx.isOwner) {
              marker.on("dragend", (e) => {
                const p = (e.target as L.Marker).getLatLng();
                persist({ center: [p.lng, p.lat] });
              });
              map.on("click", (e: L.LeafletMouseEvent) => {
                marker.setLatLng(e.latlng);
                persist({ center: [e.latlng.lng, e.latlng.lat] });
              });
              // Remember the zoom the owner settles on.
              map.on("zoomend", () => {
                const z = map.getZoom();
                if (z !== zoom) persist({ zoom: z });
              });
            }

            return () => map.remove();
          }}
        />

        <LocationLabel
          label={m.label || m.microTitle || ""}
          isOwner={ctx.isOwner}
          onPick={(match) =>
            persist({ center: [match.lng, match.lat], label: match.label })
          }
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
              className="absolute left-3 right-3 top-full z-30 rounded-md overflow-hidden"
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
