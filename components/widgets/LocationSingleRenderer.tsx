"use client";

import { useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { LocationSingleWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { MapCanvas, OSM_TILES, OSM_ATTRIBUTION } from "./MapCanvas";

/**
 * Eine Location — single pinned map.
 *
 * Owner can move the pin by clicking the map (fires a PUT to the
 * widget endpoint). No regenerate — this is user-confirmed data.
 *
 * Attribution: OpenStreetMap / ODbL (shown in tile layer).
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

  async function movePin(newLng: number, newLat: number) {
    if (!ctx.isOwner) return;
    await fetch(`/api/spaces/${ctx.spaceId}/widgets/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        widget: { ...m, center: [newLng, newLat] },
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
          height={220}
          deps={[lat, lng, zoom, ctx.isOwner]}
          setup={(L, el) => {
            const map = L.map(el, { scrollWheelZoom: false }).setView([lat, lng], zoom);
            L.tileLayer(OSM_TILES, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map);

            const icon = L.divIcon({
              html: `<div style="
                width:12px;height:12px;border-radius:50%;
                background:var(--v-fg);
                border:2px solid var(--v-bg);
                box-shadow:0 1px 4px rgba(0,0,0,0.25);
              "></div>`,
              className: "",
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            });

            const marker = L.marker([lat, lng], { icon, draggable: ctx.isOwner }).addTo(map);

            if (m.label) {
              marker.bindTooltip(m.label, { permanent: true, direction: "top", offset: [0, -8], className: "" });
            }

            if (ctx.isOwner) {
              marker.on("dragend", (e) => {
                const p = (e.target as L.Marker).getLatLng();
                movePin(p.lng, p.lat);
              });
              map.on("click", (e: L.LeafletMouseEvent) => {
                marker.setLatLng(e.latlng);
                movePin(e.latlng.lng, e.latlng.lat);
              });
            }

            return () => map.remove();
          }}
        />

        {(m.label || m.microTitle) && (
          <div className="px-4 py-3">
            <div className="mono text-[11px] tracking-widest" style={{ color: "var(--v-fg)" }}>
              {m.label || m.microTitle}
            </div>
          </div>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}
