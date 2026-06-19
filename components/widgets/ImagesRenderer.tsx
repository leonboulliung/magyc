"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { ImagesWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { UploadZone } from "./UploadZone";
import { FullscreenOverlay } from "./FullscreenOverlay";

/**
 * Bild-Ablage — image gallery. Uploads stored in Supabase Storage,
 * displayed as a tidy square-crop grid. Click any image to view it in its
 * true aspect ratio (full-screen lightbox); hover to remove. Any
 * collaborator can add images.
 */
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
      url: typeof e.data.url === "string" ? (e.data.url as string) : "",
      name: typeof e.data.name === "string" ? (e.data.name as string) : "",
    }))
    .filter((f) => f.url && !deleted.has(f.key));

  const removeImage = (key: string) => ctx.act(index, "edit", { id: key, deleted: true });

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description} bare>
        {images.length === 0 ? (
          <p className="mono px-4 pb-1 pt-10 pr-24 text-[11px] opacity-50" style={{ color: "var(--v-muted)" }}>
            {m.placeholder ?? "Noch keine Bilder — lade welche hoch."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1 p-1 pt-10 sm:grid-cols-3">
            <AnimatePresence initial={false}>
              {images.map((img) => (
                <motion.figure
                  key={img.key}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="group/img relative m-0 overflow-hidden rounded-[var(--v-radius)]"
                  style={{ border: "1px solid var(--v-rule)" }}
                >
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: img.url, name: img.name })}
                    className="block overflow-hidden"
                    style={{ aspectRatio: "1 / 1" }}
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

        <div className="px-3 pb-3 pt-2">
          <UploadZone spaceId={ctx.spaceId} moduleIndex={index} accept="image/*" multiple compact>
            <span className="mono tracking-widest opacity-70">▨ Bilder</span>
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
              style={{ borderRadius: "var(--v-radius)" }}
            />
          </div>
        </FullscreenOverlay>
      )}
    </WidgetShell>
  );
}
