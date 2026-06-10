"use client";

import { useWidgetContext } from "@/lib/widgetContext";
import type { RouteWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { MapCanvas, OSM_TILES } from "./MapCanvas";

/**
 * Route — ordered stops connected by a polyline. The CSV notes this
 * is a map render of a multi-stop journey. No turn-by-turn routing —
 * we draw straight lines between stops and label each one.
 *
 * We number each stop visually (①②③…) in the label list below the map.
 */
export function RouteRenderer({
  module: m,
  index,
}: {
  module: RouteWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const stops = m.stops;

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard
        microTitle={m.microTitle}
        description={m.description}
        attribution={m.attribution ?? { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", license: "ODbL" }}
        bare
      >
        <MapCanvas
          height={230}
          deps={[JSON.stringify(stops)]}
          setup={(L, el) => {
            const map = L.map(el, {
              scrollWheelZoom: false,
              zoomControl: false,
              attributionControl: false,
            });
            L.tileLayer(OSM_TILES, { maxZoom: 19 }).addTo(map);

            const points: L.LatLng[] = stops.map((s) => L.latLng(s.lat, s.lng));

            // Polyline between stops — in the accent colour (color2).
            if (points.length > 1) {
              L.polyline(points, {
                color: "var(--v-accent, #6b6b6b)",
                weight: 2.5,
                opacity: 0.85,
                dashArray: "6 5",
              }).addTo(map);
            }

            // Stop markers — numbered, accent-filled.
            const NUMERALS = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"];
            stops.forEach((stop, i) => {
              const numeral = NUMERALS[i] ?? String(i + 1);
              const icon = L.divIcon({
                html: `<div style="
                  width:20px;height:20px;border-radius:50%;
                  background:var(--v-accent);
                  color:#fff;
                  display:flex;align-items:center;justify-content:center;
                  font-size:11px;font-weight:700;
                  border:2.5px solid #fff;
                  box-shadow:0 1px 3px rgba(0,0,0,0.2);
                ">${numeral}</div>`,
                className: "",
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              });
              const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(map);
              if (stop.label) {
                marker.bindTooltip(stop.label, { permanent: i === 0 || i === stops.length - 1, direction: "top", offset: [0, -12] });
              }
            });

            if (points.length > 0) {
              map.fitBounds(L.latLngBounds(points).pad(0.2));
            } else {
              map.setView([48.137, 11.576], 5);
            }

            return () => map.remove();
          }}
        />

        {stops.length > 0 && (
          <div className="px-4 py-3 space-y-1">
            {stops.map((stop, i) => {
              const NUMERALS = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"];
              return (
                <div key={i} className="flex items-baseline gap-2">
                  <span className="mono text-[10px] shrink-0" style={{ color: "var(--v-muted)" }}>
                    {NUMERALS[i] ?? i + 1}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--v-fg)" }}>
                    {stop.label ?? `${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}
