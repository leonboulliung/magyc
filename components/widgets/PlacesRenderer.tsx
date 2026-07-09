"use client";

import { useWidgetContext } from "@/lib/widgetContext";
import { useT } from "@/components/i18n/LocaleProvider";
import type { LocationSingleWidget, LocationsMultiWidget, RouteWidget } from "@/lib/types";
import { LocationPointsEditor, type LocationPoint } from "./LocationPointsEditor";
import { MapCanvas, OSM_TILES } from "./MapCanvas";
import { WidgetCard } from "./WidgetCard";
import { WidgetShell } from "./WidgetShell";

type PlacesWidget = LocationSingleWidget | LocationsMultiWidget | RouteWidget;

function pointsFor(module: PlacesWidget): LocationPoint[] {
  if (module.type === "location_single") {
    return [{ lng: module.center[0], lat: module.center[1], label: module.label }];
  }
  return module.type === "route" ? module.stops : module.locations;
}

/** One place model and one editor for all historic map element variants. */
export function PlacesRenderer({ module: m, index }: { module: PlacesWidget; index: number }) {
  const ctx = useWidgetContext();
  const tr = useT();
  const points = pointsFor(m);

  function save(points: LocationPoint[]) {
    if (m.type === "location_single") {
      const first = points[0];
      if (!first) return;
      void ctx.saveModule(index, { ...m, center: [first.lng, first.lat], label: first.label }, { quiet: ctx.mode === "preset" });
      return;
    }
    if (m.type === "route") {
      void ctx.saveModule(index, { ...m, stops: points }, { quiet: ctx.mode === "preset" });
      return;
    }
    void ctx.saveModule(index, { ...m, locations: points }, { quiet: ctx.mode === "preset" });
  }

  return (
    <WidgetShell module={m} index={index}>
      <WidgetCard
        microTitle={m.microTitle ?? "Orte"}
        description={m.description}
        attribution={m.attribution ?? { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", license: "ODbL" }}
        bare
        allowOverflow
      >
        {ctx.isOwner ? (
          <LocationPointsEditor points={points} minItems={m.type === "location_single" ? 1 : 0} onChange={save} />
        ) : points.length > 0 ? (
          <div className="space-y-1.5 px-3.5 pb-3">
            {points.map((point, pointIndex) => (
              <div key={`${point.lng}-${point.lat}-${pointIndex}`} className="flex items-center gap-2 rounded-[var(--v-radius)] px-3 py-2 text-[12px]" style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}>
                <span className="mono text-[10px] opacity-45">{pointIndex + 1}</span>
                <span className="truncate">{point.label || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-3.5 pb-3 text-[12px]" style={{ color: "var(--v-muted)" }}>{tr.elements.noPlaces}</p>
        )}

        <div className="mx-3.5 overflow-hidden rounded-[calc(var(--v-radius)*0.72)]">
          <MapCanvas
            height={180}
            deps={[JSON.stringify(points)]}
            setup={(L, el) => {
              const map = L.map(el, { scrollWheelZoom: false, zoomControl: false, attributionControl: false });
              L.tileLayer(OSM_TILES, { maxZoom: 19 }).addTo(map);
              const icon = L.divIcon({
                html: '<div style="width:13px;height:13px;border-radius:50%;background:var(--v-accent);border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>',
                className: "",
                iconSize: [13, 13],
                iconAnchor: [6.5, 6.5],
              });
              const markers = points.map((point) => {
                const latlng = L.latLng(point.lat, point.lng);
                const marker = L.marker(latlng, { icon }).addTo(map);
                if (point.label) marker.bindTooltip(point.label, { direction: "top", offset: [0, -6] });
                return latlng;
              });
              if (markers.length) map.fitBounds(L.latLngBounds(markers).pad(0.24), { maxZoom: 14 });
              else map.setView([51.1657, 10.4515], 5);
              return () => map.remove();
            }}
          />
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}
