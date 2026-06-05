"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-gesture-handling/dist/leaflet-gesture-handling.css";
import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import { PARIS_BOUNDS, PARIS_CENTER } from "@/lib/quartiers";
import type { Card } from "@/lib/types";
import { parisTimeOfDay } from "@/lib/time";
import { TOD_LABEL, type TimeOfDay } from "@/lib/vibe";
import { cardColor } from "@/lib/color";
import { useIsDesktop } from "@/lib/hooks";

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
  /**
   * If set with a located card, the map centers on that card's pin at
   * street-level zoom and releases the Paris max-bounds — so a pin near
   * the edge of the metro area (Courbevoie, Vincennes, …) still sits
   * centered. Intended for the detail-page mini-map.
   */
  focusedCard?: Card;
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
  focusedCard,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pickedMarkerRef = useRef<L.Marker | null>(null);
  const LRef = useRef<typeof L | null>(null);
  const pickHandlerRef = useRef<((ll: { lat: number; lng: number }) => void) | null>(null);
  const [ready, setReady] = useState(false);
  // Preview state holds only the card; the screen position is derived from
  // the map's current projection on every render, so the panel stays glued
  // to the pin as the user pans or zooms.
  const [preview, setPreview] = useState<{ card: Card } | null>(null);
  // Bumped on every map move/zoom event so the preview re-renders with a
  // fresh container-point for its pin. Only subscribed while preview is open.
  const [previewTick, setPreviewTick] = useState(0);
  const [tod, setTod] = useState<TimeOfDay>(() =>
    typeof window === "undefined" ? "midday" : parisTimeOfDay(),
  );
  const isDesktop = useIsDesktop();

  // Re-check the real Paris sun-derived time-of-day every minute so the map
  // drifts through dawn → midday → golden → night with actual sun position.
  useEffect(() => {
    const tick = () => {
      const next = parisTimeOfDay();
      setTod((prev) => (prev === next ? prev : next));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Drive the time-based pin states (distant → approaching → imminent →
  // live → past) by bumping a tick every 30s. Cheap; only the marker
  // re-render depends on it.
  const [timeTick, setTimeTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTimeTick((n) => n + 1), 30_000);
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
        // We add attribution manually below at bottomleft so it doesn't
        // collide with the right-docked feed panel on home.
        attributionControl: false,
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
            // Attribution is rendered by the manual control below, at bottomleft.
            attribution: "",
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

      // Attribution lives at bottom-left so it never collides with the
      // right-docked feed panel on home (or the FAB on mobile bottom-right).
      leaflet.control
        .attribution({ position: "bottomleft", prefix: false })
        .addAttribution('© <a href="https://carto.com/attributions">CARTO</a> · OSM')
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
    const now = Date.now();
    for (const c of cards) {
      // A card without a location has nothing to pin on the map.
      if (!c.location) continue;
      const isFresh = freshIds?.has(c.id);
      const color = cardColor(c);

      // ── Crew fill (0..1): scales the persistent halo behind the pin.
      //     Only joined members count — requests don't carry weight. ──
      const joinedCount = c.members.filter((m) => m.state === "joined").length;
      const crewFill =
        c.spots && c.spots > 0
          ? Math.min(1, joinedCount / c.spots)
          : joinedCount > 0
            ? Math.min(1, joinedCount / 4)
            : 0;

      // ── Time state: reads startsAt + endsAt. ──
      let timeState: "distant" | "approaching" | "imminent" | "live" | "past" = "distant";
      if (c.startsAt) {
        const start = c.startsAt;
        const end = c.endsAt ?? start + 3 * 60 * 60 * 1000; // assume 3h if no end
        if (now >= start && now <= end) timeState = "live";
        else if (now > end) timeState = "past";
        else {
          const minsToStart = (start - now) / 60_000;
          if (minsToStart <= 60) timeState = "imminent";
          else if (minsToStart <= 24 * 60) timeState = "approaching";
          else timeState = "distant";
        }
      }

      const pinStyle = [
        `--pin-color:${color}`,
        `--pin-crew:${crewFill.toFixed(2)}`,
      ].join(";");
      const icon = L.divIcon({
        className: "",
        html: `<div class="cp-pin ${isFresh ? "fresh" : ""}" data-time="${timeState}" style="${pinStyle}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const m = L.marker([c.location.lat, c.location.lng], { icon, riseOnHover: true });
      // Editorial title tooltip on hover (desktop).
      // On touch, tap opens the rich preview below instead.
      m.bindTooltip(c.title.toUpperCase(), {
        direction: "right",
        offset: [10, 0],
        opacity: 1,
        className: "cp-pin-tooltip",
        // On touch there is no hover, so the title-strip stays visible
        // permanently next to each pin. Desktop keeps the hover behavior.
        permanent: !isDesktop,
      });
      m.on("click", (e: L.LeafletMouseEvent) => {
        // Hide the title strip — the click preview takes over.
        m.closeTooltip();
        setPreview({ card: c });
        L.DomEvent.stopPropagation(e);
      });
      // Whenever the user mouses off and back on, the tooltip can come back —
      // but as long as the click preview is open we keep it suppressed.
      m.on("tooltipopen", () => {
        if (preview && preview.card.id === c.id) m.closeTooltip();
      });
      m.addTo(layerRef.current!);
    }
  }, [cards, ready, freshIds, highlightId, isDesktop, timeTick]);

  // While the click-preview is open, re-project on every map move/zoom so
  // the panel stays anchored to its pin. We only subscribe when preview is
  // active to avoid bumping React on every pan when there's nothing to
  // re-position.
  useEffect(() => {
    if (!preview || !mapRef.current) return;
    const map = mapRef.current;
    const tick = () => setPreviewTick((n) => n + 1);
    map.on("move", tick);
    map.on("zoom", tick);
    return () => {
      map.off("move", tick);
      map.off("zoom", tick);
    };
  }, [preview]);

  // Detail-page mini-map: center the view on the focused card's pin and
  // drop max-bounds so a pin near the edge of the metro area still sits
  // centered. Only runs when an explicit focusedCard with a location is
  // passed in — leaves the home map untouched.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!focusedCard?.location) return;
    mapRef.current.setMaxBounds(undefined as never);
    mapRef.current.setView(
      [focusedCard.location.lat, focusedCard.location.lng],
      14,
      { animate: false },
    );
  }, [ready, focusedCard]);

  // picked pin (compose mode)
  useEffect(() => {
    if (!ready || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    if (pickedMarkerRef.current) {
      pickedMarkerRef.current.remove();
      pickedMarkerRef.current = null;
    }
    if (pickedLatLng) {
      const color = pickedColors?.inner || "#0a0a0a";
      const icon = L.divIcon({
        className: "",
        html: `<div class="cp-pin fresh" style="--pin-color:${color}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
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
      {(() => {
        if (!preview || !mapRef.current || !preview.card.location) return null;
        // previewTick is read so React re-runs this projection on every pan.
        void previewTick;
        const pt = mapRef.current.latLngToContainerPoint([
          preview.card.location.lat,
          preview.card.location.lng,
        ]);
        return (
          <button
            onClick={() => {
              onSelectCard?.(preview.card.id);
              setPreview(null);
            }}
            className="absolute z-[400] -translate-x-1/2 bg-paper border border-rule-strong shadow-xl text-left animate-fadeIn"
            style={{ left: pt.x, top: pt.y + 14, width: 260 }}
          >
            <div className="px-3 py-2 border-b border-rule-strong mono text-[10px] tracking-widest flex justify-between">
              <span>
                {preview.card.location?.label.toUpperCase() || "OPEN"}
              </span>
              <span className="opacity-70">
                {preview.card.startsAt
                  ? new Date(preview.card.startsAt).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase()
                  : "OPEN"}
              </span>
            </div>
            <div className="px-3 py-2">
              <div className="font-black editorial text-[20px] leading-[0.95] line-clamp-3">
                {preview.card.title}
              </div>
              <div className="mono text-[10px] mt-2 opacity-70">
                {(() => {
                  const joined = preview.card.members.filter((m) => m.state === "joined").length;
                  return `${joined}/${preview.card.spots ?? "—"} PEOPLE · TAP TO OPEN →`;
                })()}
              </div>
            </div>
          </button>
        );
      })()}
    </div>
  );
}
