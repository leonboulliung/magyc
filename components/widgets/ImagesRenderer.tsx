"use client";

import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { ImagesWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { UploadZone } from "./UploadZone";

/**
 * Bild-Ablage — image gallery. Uploads stored in Supabase Storage;
 * displayed as a responsive masonry-ish grid (two columns).
 * Any collaborator can add images.
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

  const images = state
    .filter((e) => e.kind === "upload" && typeof e.data.mimeType === "string" && (e.data.mimeType as string).startsWith("image/"))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      key: e.id,
      url: typeof e.data.url === "string" ? (e.data.url as string) : "",
      name: typeof e.data.name === "string" ? (e.data.name as string) : "",
    }))
    .filter((f) => f.url);

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description} bare>
        {images.length === 0 && (
          <div className="p-4">
            <p className="mono text-[11px] opacity-50" style={{ color: "var(--v-muted)" }}>
              {m.placeholder ?? "Noch keine Bilder — lade welche hoch."}
            </p>
          </div>
        )}

        {images.length > 0 && (
          <div
            className="grid gap-0.5 p-0.5"
            style={{ gridTemplateColumns: "repeat(2, 1fr)" }}
          >
            <AnimatePresence initial={false}>
              {images.map((img) => (
                <motion.a
                  key={img.key}
                  layout
                  href={img.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="block overflow-hidden"
                  style={{ aspectRatio: "1 / 1" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                </motion.a>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="p-3">
          <UploadZone
            spaceId={ctx.spaceId}
            moduleIndex={index}
            accept="image/*"
            multiple
            onDone={() => {}}
          >
            <span className="mono text-[10px] tracking-widest opacity-60">▨ +</span>
          </UploadZone>
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}
