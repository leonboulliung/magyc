"use client";

import { useWidgetContext } from "@/lib/widgetContext";
import type { LocationsMultiWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { MapCanvas, OSM_TILES } from "./MapCanvas";

/**
 * Mehrere Locations — multiple pins on one map. Fits all markers in
 * the initial viewport (fitBounds). No editing beyond regenerate.
 */
export function LocationsMultiRenderer({
  module: m,
  index,
}: {
  module: LocationsMultiWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const locs = m.locations;

  return (
    <WidgetShell module={m} index={index}>
      <WidgetCard
        microTitle={m.microTitle}
        description={m.description}
        attribution={m.attribution ?? { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", license: "ODbL" }}
        bare
      >
        <MapCanvas
          height={220}
          deps={[JSON.stringify(locs)]}
          setup={(L, el) => {
            const map = L.map(el, {
              scrollWheelZoom: false,
              zoomControl: false,
              attributionControl: false,
            });
            L.tileLayer(OSM_TILES, { maxZoom: 19 }).addTo(map);

            const icon = L.divIcon({
              html: `<div style="
                width:13px;height:13px;border-radius:50%;
                background:var(--v-accent);
                border:2.5px solid #fff;
                box-shadow:0 1px 3px rgba(0,0,0,0.2);
              "></div>`,
              className: "",
              iconSize: [13, 13],
              iconAnchor: [6.5, 6.5],
            });

            const markers: L.LatLng[] = [];
            for (const loc of locs) {
              const latlng = L.latLng(loc.lat, loc.lng);
              markers.push(latlng);
              const marker = L.marker(latlng, { icon }).addTo(map);
              if (loc.label) {
                marker.bindTooltip(loc.label, { permanent: false, direction: "top", offset: [0, -6] });
              }
            }

            if (markers.length > 0) {
              map.fitBounds(L.latLngBounds(markers).pad(0.2));
            } else {
              map.setView([48.137, 11.576], 5);
            }

            return () => map.remove();
          }}
        />

        {locs.length > 0 && (
          <div className="px-4 py-3 flex flex-wrap gap-x-3 gap-y-1">
            {locs.map((loc, i) => (
              <span key={i} className="mono text-[10px] tracking-widest" style={{ color: "var(--v-muted)" }}>
                {loc.label ?? `${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}`}
              </span>
            ))}
          </div>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}
