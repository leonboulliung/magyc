"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as L from "leaflet";
import type { TrackEntry } from "@/lib/types";
import { PARIS_BOUNDS } from "@/lib/quartiers";
import { cardColor } from "@/lib/color";

interface Props {
  entries: TrackEntry[];
  className?: string;
  /** Aspect ratio in "w/h" form. Default ~4:3 — Paris is wider than tall. */
  aspect?: string;
}

type LatLngTuple = [number, number];

/** A plotted point: an entry with its (possibly fanned-out) coordinates. */
type PlottedPoint = { entry: TrackEntry; lat: number; lng: number };

/**
 * De-collide coincident pins. Picking a quartier suggestion (e.g. "Le Marais")
 * gives every card the identical quartier centre, so multiple cards stack into
 * a single marker. We fan any group that shares a coordinate out into a small
 * circle around their common centre — deterministic, so the layout is stable —
 * and scale the longitude offset by 1/cos(lat) so the fan reads visually round
 * at Paris latitude. Single points are left untouched.
 */
function deCollide(entries: TrackEntry[]): PlottedPoint[] {
  // Loose key — three decimals (~110m) so cards pinned to the same quartier
  // *or to nearby points within a block* are recognized as a cluster and
  // fanned out together. Four decimals (~11m) was too strict: visually
  // overlapping pins at e.g. neighbouring Marais addresses kept their own
  // keys and never fanned.
  const groups = new Map<string, TrackEntry[]>();
  const keyOf = (e: TrackEntry) =>
    `${e.card.location!.lat.toFixed(3)},${e.card.location!.lng.toFixed(3)}`;
  for (const e of entries) {
    const k = keyOf(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }

  const LAT_R = 0.0014; // ~155m fan radius — readable at typical Paris zoom

  return entries.map((e) => {
    const { lat, lng } = e.card.location!;
    const group = groups.get(keyOf(e))!;
    if (group.length === 1) return { entry: e, lat, lng };

    const idx = group.indexOf(e);
    const n = group.length;
    // Start at the top, distribute clockwise around the shared centre.
    const angle = (2 * Math.PI * idx) / n - Math.PI / 2;
    const lngR = LAT_R / Math.max(0.3, Math.cos((lat * Math.PI) / 180));
    return {
      entry: e,
      lat: lat + LAT_R * Math.sin(angle),
      lng: lng + lngR * Math.cos(angle),
    };
  });
}

// Cycle label placement around the dot so two near-by markers don't pile
// their numbers on top of each other.
const LABEL_OFFSETS: { top: number; left: number; align: "left" | "right" }[] = [
  { top: -18, left: 10, align: "left" },   // top-right
  { top: 8, left: 10, align: "left" },     // bottom-right
  { top: -18, left: -10, align: "right" }, // top-left
  { top: 8, left: -10, align: "right" },   // bottom-left
];

/** Bounds that frame a set of already-plotted points (with small buffer). */
function boundsForPoints(pts: PlottedPoint[]): [LatLngTuple, LatLngTuple] {
  if (pts.length === 0) return PARIS_BOUNDS;
  if (pts.length === 1) {
    const off = 0.012; // ~1.3km square
    return [
      [pts[0].lat - off, pts[0].lng - off],
      [pts[0].lat + off, pts[0].lng + off],
    ];
  }
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const padLat = Math.max(0.004, (maxLat - minLat) * 0.18);
  const padLng = Math.max(0.004, (maxLng - minLng) * 0.18);
  return [
    [minLat - padLat, minLng - padLng],
    [maxLat + padLat, maxLng + padLng],
  ];
}

export function Constellation({ entries, className = "", aspect = "4 / 3" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const LRef = useRef<typeof L | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  // Only cards with a real location can be plotted. Ideas without a loose pin
  // are simply omitted from the constellation.
  const geoEntries = useMemo(
    () => entries.filter((e) => !!e.card.location),
    [entries],
  );
  // Fan out coincident pins so every entry stays visible, then frame to that.
  const plotted = useMemo(() => deCollide(geoEntries), [geoEntries]);
  const fitBounds = useMemo(() => boundsForPoints(plotted), [plotted]);

  // Mount the Leaflet map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const leaflet = ((mod as unknown as { default?: typeof L }).default ?? (mod as unknown as typeof L)) as typeof L;
      if (cancelled || !ref.current) return;
      LRef.current = leaflet;

      const map = leaflet.map(ref.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
        // @ts-expect-error: tap is accepted at runtime
        tap: false,
      });

      leaflet
        .tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
          subdomains: "abcd",
          maxZoom: 19,
        })
        .addTo(map);

      const group = leaflet.layerGroup().addTo(map);
      overlayRef.current = group;
      mapRef.current = map;

      // Initial fit
      map.fitBounds(fitBounds as unknown as L.LatLngBoundsExpression, {
        padding: [16, 16],
        animate: false,
      });

      const invalidateAndFit = () => {
        map.invalidateSize({ animate: false });
        const b = boundsForPoints(deCollide(entries.filter((e) => !!e.card.location)));
        map.fitBounds(b as unknown as L.LatLngBoundsExpression, {
          padding: [16, 16],
          animate: false,
        });
      };
      requestAnimationFrame(invalidateAndFit);
      const t1 = window.setTimeout(invalidateAndFit, 120);
      const t2 = window.setTimeout(invalidateAndFit, 400);

      let ro: ResizeObserver | null = null;
      if (ref.current && typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(invalidateAndFit);
        ro.observe(ref.current);
      }

      (map as unknown as { _cpCleanup?: () => void })._cpCleanup = () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        ro?.disconnect();
      };

      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        const m = mapRef.current as unknown as { _cpCleanup?: () => void };
        m._cpCleanup?.();
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // We intentionally only set this up once — entries are wired in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render overlay (markers + connector polyline) whenever entries change
  // — and ALSO once the map first becomes ready (otherwise the first entries
  // arrive before the map exists and never re-render).
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const L = LRef.current;
    const group = overlayRef.current;
    if (!map || !L || !group) return;
    group.clearLayers();

    // Use the de-collided coordinates so stacked pins fan out and every
    // entry is distinct. Chronological order drives the numbering + path.
    const ordered = plotted.slice().sort((a, b) => a.entry.at - b.entry.at);

    if (ordered.length > 1) {
      const latlngs: LatLngTuple[] = ordered.map((p) => [p.lat, p.lng]);
      L.polyline(latlngs, {
        color: "#0a0a0a",
        opacity: 0.45,
        weight: 1.8,
        dashArray: "5 5",
        interactive: false,
      }).addTo(group);
    }

    ordered.forEach((p, i) => {
      const inner = cardColor(p.entry.card);
      // Outer ring used to come from the category; we now use ink for a
      // clean, editorial look that reads against any tile palette.
      const outer = "#0a0a0a";
      // Cycle the label position around the dot so adjacent numbers don't
      // pile up into an unreadable smudge.
      const off = LABEL_OFFSETS[i % LABEL_OFFSETS.length];
      const labelStyle =
        off.align === "left"
          ? `left:${off.left}px; text-align:left;`
          : `right:${-off.left}px; text-align:right;`;
      const html = `
        <div style="position:relative; pointer-events:none;">
          <div style="
            width:12px; height:12px; border-radius:50%;
            background:${inner};
            border: 3px solid ${outer};
            box-shadow: 0 0 0 2px #ffffff;
            transform: translate(-9px, -9px);
          "></div>
          <span style="
            position:absolute; top:${off.top}px; ${labelStyle}
            font-family:'JetBrains Mono', ui-monospace, monospace;
            font-size:10px; font-weight:600; color:#0a0a0a;
            white-space:nowrap;
            text-shadow: 0 0 3px #fff, 0 0 3px #fff;
          ">${i + 1}</span>
        </div>`;
      const icon = L.divIcon({
        className: "",
        html,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([p.lat, p.lng], {
        icon,
        interactive: false,
        keyboard: false,
      }).addTo(group);
    });

    // Always refit to the fanned-out bounds when they change.
    map.invalidateSize({ animate: false });
    map.fitBounds(fitBounds as unknown as L.LatLngBoundsExpression, {
      padding: [16, 16],
      animate: false,
    });
  }, [plotted, ready, fitBounds]);

  return (
    <div
      className={`relative bg-paper overflow-hidden ${className}`}
      style={{ aspectRatio: aspect, maxHeight: "min(70vh, 520px)" }}
    >
      <div ref={ref} className="absolute inset-0" />
      {entries.length === 0 && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="mono text-[11px] tracking-widest opacity-50 bg-paper px-2 py-1">
            NO PINS YET
          </span>
        </div>
      )}
    </div>
  );
}
