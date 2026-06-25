"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { ImagesWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { UploadZone } from "./UploadZone";
import { FullscreenOverlay } from "./FullscreenOverlay";
import { assetPathFromData, assetUrlFromData, useAssetUrls } from "./useAssetUrls";

/**
 * Bild-Ablage — image collection. Uploads are compressed client-side, stored
 * in Supabase Storage, and shown as a tidy responsive grid of square crops.
 * Click any image to view it in its true aspect ratio (lightbox); hover to
 * remove. Any collaborator can add images.
 */

// A small, rectangular corner — the var(--v-radius) (28px) read as "round"
// on these mid-size tiles. A fixed modest radius keeps the gallery crisp.
const TILE_RADIUS = 12;

export function ImagesRenderer({
  module: m,
  index,
  state,
}: {
  module: ImagesWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const assetPaths = state
    .filter((e) => e.kind === "upload")
    .map((e) => assetPathFromData(e.data))
    .filter(Boolean);
  const signedUrls = useAssetUrls(ctx.spaceId, assetPaths);

  const deleted = new Set<string>();
  for (const e of state) {
    if (e.kind === "edit" && e.data.deleted === true && typeof e.data.id === "string") {
      deleted.add(e.data.id);
    }
  }

  const images = state
    .filter((e) => e.kind === "upload" && typeof e.data.mimeType === "string" && (e.data.mimeType as string).startsWith("image/"))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      key: e.id,
      url: assetUrlFromData(e.data, signedUrls),
      name: typeof e.data.name === "string" ? (e.data.name as string) : "",
    }))
    .filter((f) => f.url && !deleted.has(f.key));

  const removeImage = (key: string) => ctx.act(index, "edit", { id: key, deleted: true });

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {images.length === 0 ? (
          <p className="mono pr-24 text-[11px] leading-relaxed opacity-50" style={{ color: "var(--v-muted)" }}>
            {m.placeholder ?? "Noch keine Bilder — lade welche hoch."}
          </p>
        ) : (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
          >
            <AnimatePresence initial={false}>
              {images.map((img) => (
                <motion.figure
                  key={img.key}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="group/img relative m-0 overflow-hidden"
                  style={{ aspectRatio: "1 / 1", borderRadius: TILE_RADIUS, border: "1px solid var(--v-rule)" }}
                >
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: img.url, name: img.name })}
                    className="block h-full w-full"
                    title="Groß ansehen"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(img.key)}
                    aria-label="Bild entfernen"
                    className="mono absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] leading-none text-white opacity-0 transition-opacity group-hover/img:opacity-90 hover:!opacity-100"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    ×
                  </button>
                </motion.figure>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-3">
          <UploadZone spaceId={ctx.spaceId} moduleIndex={index} accept="image/*" multiple compact>
            <span className="mono tracking-widest opacity-70">▨ Bilder hochladen · JPG PNG WEBP HEIC · max. 50 MB</span>
          </UploadZone>
        </div>
      </WidgetCard>

      {lightbox && (
        <FullscreenOverlay title={lightbox.name || "Bild"} onClose={() => setLightbox(null)}>
          <div className="flex h-full items-center justify-center p-4 sm:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="max-h-full max-w-full object-contain"
              style={{ borderRadius: TILE_RADIUS }}
            />
          </div>
        </FullscreenOverlay>
      )}
    </WidgetShell>
  );
}
