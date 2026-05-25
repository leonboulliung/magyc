"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-gesture-handling/dist/leaflet-gesture-handling.css";
import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import { PARIS_BOUNDS, PARIS_CENTER } from "@/lib/quartiers";
import type { Card } from "@/lib/types";
import { parisHour } from "@/lib/time";
import { TOD_LABEL, timeOfDayFromHour, type TimeOfDay } from "@/lib/vibe";
import { cardColor, categoryColor } from "@/lib/color";

// Module-scope flag — the plugin only needs registering once per page.
let gestureHandlerRegistered = false;

interface MapPin {
  id: string;
  lat: number;
  lng: number;
  fresh?: boolean;
}

interface Props {
  cards: Card[];
  height?: string;
  selectable?: boolean;
  pickedLatLng?: { lat: number; lng: number } | null;
  /** Colors for the picked pin (the one the user is currently dropping). */
  pickedColors?: { inner: string; outer: string };
  onPick?: (latlng: { lat: number; lng: number }) => void;
  onSelectCard?: (id: string) => void;
  freshIds?: Set<string>;
  highlightId?: string;
  className?: string;
  /**
   * When true (default), single-finger touch on mobile shows
   * "Use two fingers to move the map" and lets the page scroll past.
   * Set false for full-screen map views where the map IS the page.
   */
  gestureHandling?: boolean;
}

export function ParisMap({
  cards,
  height = "100%",
  selectable = false,
  pickedLatLng,
  pickedColors,
  onPick,
  onSelectCard,
  freshIds,
  highlightId,
  className = "",
  gestureHandling = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pickedMarkerRef = useRef<L.Marker | null>(null);
  const LRef = useRef<typeof L | null>(null);
  const pickHandlerRef = useRef<((ll: { lat: number; lng: number }) => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<{ card: Card; x: number; y: number } | null>(null);
  const [tod, setTod] = useState<TimeOfDay>(() =>
    typeof window === "undefined" ? "midday" : timeOfDayFromHour(parisHour()),
  );

  // Re-check the Paris time-of-day every minute so the map slowly drifts
  // through dawn → midday → golden → night with the actual city.
  useEffect(() => {
    const tick = () => {
      const next = timeOfDayFromHour(parisHour());
      setTod((prev) => (prev === next ? prev : next));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // keep latest onPick reachable without rebinding the map click listener
  useEffect(() => {
    pickHandlerRef.current = onPick || null;
  }, [onPick]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const mod = await import("leaflet");
      const leaflet = ((mod as unknown as { default?: typeof L }).default ?? (mod as unknown as typeof L)) as typeof L;
      if (!mounted || !ref.current) return;
      LRef.current = leaflet;

      // Register the gestureHandling plugin once per page. addInitHook adds a
      // global handler that every subsequent leaflet.map(…) instance will
      // pick up if it passes { gestureHandling: true }.
      if (gestureHandling && !gestureHandlerRegistered) {
        try {
          const gh = await import("leaflet-gesture-handling");
          const Handler =
            (gh as unknown as { GestureHandling?: unknown }).GestureHandling ??
            (gh as unknown as { default?: unknown }).default;
          if (Handler) {
            // 3-arg form of addInitHook: (methodName, args...) — runs
            // map.addHandler("gestureHandling", Handler) on every map init.
            // Not in Leaflet's TS signatures, so cast through.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (leaflet.Map as any).addInitHook("addHandler", "gestureHandling", Handler);
            gestureHandlerRegistered = true;
          }
        } catch {
          // plugin failed to load — fall through, map still works without
        }
      }

      const map = leaflet.map(ref.current, {
        center: PARIS_CENTER,
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
        maxBounds: PARIS_BOUNDS as unknown as L.LatLngBoundsExpression,
        maxBoundsViscosity: 0.85,
        minZoom: 11,
        maxZoom: 17,
        ...(gestureHandling
          ? ({
              gestureHandling: true,
              gestureHandlingOptions: {
                text: {
                  touch: "Use two fingers to move the map",
                  scroll: "Use ⌘ + scroll to zoom",
                  scrollMac: "Use ⌘ + scroll to zoom",
                },
                duration: 1200,
              },
            } as unknown as Record<string, unknown>)
          : {}),
      } as L.MapOptions);
      // Base tiles: Positron without labels (clean B&W substrate).
      leaflet
        .tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
          {
            attribution: '© <a href="https://carto.com/attributions">CARTO</a> · OSM',
            subdomains: "abcd",
            maxZoom: 19,
          },
        )
        .addTo(map);
      // Labels overlay on top — neighborhoods, streets, landmarks (Châtelet, Bastille, …).
      leaflet
        .tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
          {
            attribution: "",
            subdomains: "abcd",
            maxZoom: 19,
            pane: "overlayPane",
          },
        )
        .addTo(map);

      const group = leaflet.layerGroup().addTo(map);
      layerRef.current = group;
      mapRef.current = map;

      map.on("click", (e: L.LeafletMouseEvent) => {
        setPreview(null);
        if (selectable && pickHandlerRef.current) {
          pickHandlerRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      // Make sure the map measures the container correctly once it's actually laid out.
      const invalidate = () => {
        try { map.invalidateSize({ animate: false }); } catch { /* noop */ }
      };
      requestAnimationFrame(invalidate);
      const t1 = window.setTimeout(invalidate, 80);
      const t2 = window.setTimeout(invalidate, 250);
      const t3 = window.setTimeout(invalidate, 600);
      const t4 = window.setTimeout(invalidate, 1500);

      // React to container size changes — observe both inner + outer.
      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(invalidate);
        if (ref.current) ro.observe(ref.current);
        if (wrapRef.current) ro.observe(wrapRef.current);
      }
      const onWinResize = () => invalidate();
      window.addEventListener("resize", onWinResize);

      setReady(true);

      // store cleanup hooks on the map instance so the outer cleanup can reach them
      (map as unknown as { _cpCleanup?: () => void })._cpCleanup = () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
        window.clearTimeout(t4);
        ro?.disconnect();
        window.removeEventListener("resize", onWinResize);
      };
    })();
    return () => {
      mounted = false;
      if (mapRef.current) {
        const m = mapRef.current as unknown as { _cpCleanup?: () => void };
        m._cpCleanup?.();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [selectable]); // intentionally fixed across lifetime

  // render card markers
  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current || !LRef.current) return;
    const L = LRef.current;
    layerRef.current.clearLayers();
    for (const c of cards) {
      const isFresh = freshIds?.has(c.id);
      const inner = cardColor(c);
      const outer = categoryColor(c);
      // box-shadow rings (in order): white sep, category ring, white halo
      const shadow = `0 0 0 1.5px #ffffff, 0 0 0 3.5px ${outer}, 0 0 0 5px rgba(255,255,255,0.95)`;
      const icon = L.divIcon({
        className: "",
        html: `<div class="cp-pin ${isFresh ? "fresh" : ""}" style="background:${inner}; box-shadow:${shadow}"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const m = L.marker([c.location.lat, c.location.lng], { icon, riseOnHover: true });
      // Editorial title tooltip on hover (desktop).
      // On touch, tap opens the rich preview below instead.
      m.bindTooltip(c.title.toUpperCase(), {
        direction: "right",
        offset: [10, 0],
        opacity: 1,
        className: "cp-pin-tooltip",
      });
      m.on("click", (e: L.LeafletMouseEvent) => {
        if (!ref.current || !mapRef.current) return;
        const pt = mapRef.current.latLngToContainerPoint([c.location.lat, c.location.lng]);
        setPreview({ card: c, x: pt.x, y: pt.y });
        L.DomEvent.stopPropagation(e);
      });
      m.addTo(layerRef.current!);
    }
  }, [cards, ready, freshIds, highlightId]);

  // picked pin (compose mode)
  useEffect(() => {
    if (!ready || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    if (pickedMarkerRef.current) {
      pickedMarkerRef.current.remove();
      pickedMarkerRef.current = null;
    }
    if (pickedLatLng) {
      const inner = pickedColors?.inner || "#ffffff";
      const outer = pickedColors?.outer || "#0a0a0a";
      const shadow = `0 0 0 1.5px #ffffff, 0 0 0 3.5px ${outer}, 0 0 0 5px rgba(255,255,255,0.95)`;
      const icon = L.divIcon({
        className: "",
        html: `<div class="cp-pin fresh" style="background:${inner}; box-shadow:${shadow}"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const m = L.marker([pickedLatLng.lat, pickedLatLng.lng], {
        icon,
        draggable: true,
      }).addTo(mapRef.current);
      m.on("dragend", () => {
        const ll = m.getLatLng();
        pickHandlerRef.current?.({ lat: ll.lat, lng: ll.lng });
      });
      pickedMarkerRef.current = m;
      mapRef.current.panTo([pickedLatLng.lat, pickedLatLng.lng], { animate: true });
    }
  }, [pickedLatLng, pickedColors?.inner, pickedColors?.outer, ready]);

  return (
    <div
      ref={wrapRef}
      data-tod={tod}
      className={`relative overflow-hidden cp-map ${className}`}
      style={{ height, width: "100%" }}
    >
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
      {preview && (
        <button
          onClick={() => {
            onSelectCard?.(preview.card.id);
            setPreview(null);
          }}
          className="absolute z-[400] -translate-x-1/2 bg-paper border border-ink shadow-xl text-left animate-fadeIn"
          style={{ left: preview.x, top: preview.y + 14, width: 260 }}
        >
          <div className="px-3 py-2 border-b border-ink mono text-[10px] tracking-widest flex justify-between">
            <span>{preview.card.location.label.toUpperCase()}</span>
            <span className="opacity-70">
              {preview.card.expiresAt
                ? new Date(preview.card.expiresAt).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase()
                : ""}
            </span>
          </div>
          <div className="px-3 py-2">
            <div className="font-black editorial text-[20px] leading-[0.95] line-clamp-3">
              {preview.card.title}
            </div>
            <div className="mono text-[10px] mt-2 opacity-70">
              {preview.card.joiners.length}/{preview.card.spots} PEOPLE · TAP TO OPEN →
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
