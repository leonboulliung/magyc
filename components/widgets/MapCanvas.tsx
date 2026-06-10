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

  const init = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    // Tear down previous map instance if deps changed.
    if (teardownRef.current) {
      teardownRef.current();
      teardownRef.current = null;
      // Give Leaflet a tick to finish cleanup.
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    const L = await import("leaflet");

    // Leaflet CSS — inject once into the document head.
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Let the caller drive the rest.
    teardownRef.current = setupRef.current(L, el);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    init();
    return () => {
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

/** Shared OSM tile layer URL and attribution string. */
export const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
