"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * MapCanvas — a thin wrapper around Leaflet that lazy-imports the
 * library on first render (Leaflet requires `window`, so it cannot
 * run server-side). The parent passes a `setup` callback; it receives
 * the Leaflet module + the DOM container and is expected to return a
 * cleanup function that calls `map.remove()`.
 *
 * Using a callback instead of config props keeps every map variant
 * (single pin, multi, route) in its own renderer with full Leaflet
 * access, while this component handles all the SSR guards, tile
 * loading, and gesture handling consistently.
 *
 * Tiles: OpenStreetMap standard layer — free, no key required.
 * Attribution: shown automatically by Leaflet.
 */
export function MapCanvas({
  height = 220,
  setup,
  deps = [],
}: {
  /** Map height in px. */
  height?: number;
  /**
   * Called once with (L, container). Must return a teardown function
   * (usually `() => map.remove()`). Re-called when `deps` changes.
   */
  setup: (
    L: typeof import("leaflet"),
    container: HTMLDivElement,
  ) => () => void;
  /** Re-trigger setup when these values change (like changing coords). */
  deps?: unknown[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Store teardown to call on dep change or unmount.
  const teardownRef = useRef<(() => void) | null>(null);

  // Stable ref to setup so we don't need it in the dep array.
  const setupRef = useRef(setup);
  setupRef.current = setup;

  // Guards against overlapping async inits ("Map container is already
  // initialized"): init() awaits between the teardown check and the
  // setup call, so a re-render (StrictMode double-invoke, fast dep
  // change) can start a second init before the first finishes. Each run
  // takes a token; stale runs bail after every await.
  const runRef = useRef(0);

  const init = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    const run = ++runRef.current;

    // Tear down previous map instance if deps changed.
    if (teardownRef.current) {
      teardownRef.current();
      teardownRef.current = null;
      // Give Leaflet a tick to finish cleanup.
      await new Promise<void>((r) => setTimeout(r, 0));
      if (run !== runRef.current) return;
    }

    const L = await import("leaflet");
    if (run !== runRef.current || !containerRef.current) return;

    // Leaflet CSS — inject once into the document head.
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Last-resort: if a previous instance's teardown was lost, the
    // container still carries Leaflet's id stamp and L.map() would
    // throw. Clearing the stamp lets the new map take over the node.
    const stamped = el as HTMLDivElement & { _leaflet_id?: number };
    if (stamped._leaflet_id) delete stamped._leaflet_id;

    // Let the caller drive the rest.
    teardownRef.current = setupRef.current(L, el);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    init();
    return () => {
      // Invalidate any in-flight init so it can't set up a map on an
      // unmounted (or about-to-be-reused) container.
      runRef.current++;
      if (teardownRef.current) {
        teardownRef.current();
        teardownRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init]);

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: "100%",
        borderRadius: "inherit",
        overflow: "hidden",
        position: "relative",
        background: "var(--v-rule)",
      }}
    />
  );
}

/**
 * Shared tile layer. We use CARTO's "Positron (no labels)" basemap —
 * a very light, minimal, label-free style that reads as a calm backdrop
 * the coloured pins sit on, instead of the busy default OSM tiles with
 * their road names and POIs. Free, keyless. Retina via {r}.
 */
export const OSM_TILES =
  "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
export const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';
