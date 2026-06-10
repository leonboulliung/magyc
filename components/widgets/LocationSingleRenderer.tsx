"use client";

import { useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { LocationSingleWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { MapCanvas, OSM_TILES } from "./MapCanvas";

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
          height={200}
          deps={[lat, lng, zoom, ctx.isOwner]}
          setup={(L, el) => {
            const map = L.map(el, {
              scrollWheelZoom: false,
              zoomControl: false,
              attributionControl: false,
            }).setView([lat, lng], zoom);
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
