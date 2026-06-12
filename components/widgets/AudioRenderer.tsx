"use client";

import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { AudioWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";
import { UploadZone, fmtSize } from "./UploadZone";

/**
 * Audio-Ablage — audio file list with inline HTML5 player.
 * Anyone can upload; each track shows the uploader's ActorDot.
 */
export function AudioRenderer({
  module: m,
  index,
  state,
}: {
  module: AudioWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();

  const tracks = state
    .filter((e) => e.kind === "upload" && typeof e.data.mimeType === "string" && (e.data.mimeType as string).startsWith("audio/"))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      key: e.id,
      url: typeof e.data.url === "string" ? (e.data.url as string) : "",
      name: typeof e.data.name === "string" ? (e.data.name as string) : "audio",
      size: typeof e.data.size === "number" ? (e.data.size as number) : 0,
      authorName: e.actor.displayName,
      authorColor: typeof e.data.color === "string" ? (e.data.color as string) : undefined,
    }))
    .filter((t) => t.url);

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {tracks.length === 0 && (
          <p className="mono text-[11px] opacity-50 mb-3" style={{ color: "var(--v-muted)" }}>
            {m.placeholder ?? "…"}
          </p>
        )}

        <ul className="space-y-2 mb-3">
          <AnimatePresence initial={false}>
            {tracks.map((t) => (
              <motion.li
                key={t.key}
                layout
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 3 }}
                transition={{ duration: 0.15 }}
                className="space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="mono text-[12px] shrink-0" style={{ color: "var(--v-muted)" }}>♫</span>
                  <span className="flex-1 text-[12.5px] truncate" style={{ color: "var(--v-fg)" }}>
                    {t.name}
                  </span>
                  {t.size > 0 && (
                    <span className="mono text-[9px] shrink-0" style={{ color: "var(--v-muted)" }}>
                      {fmtSize(t.size)}
                    </span>
                  )}
                  {t.authorName && (
                    <ActorDot color={t.authorColor} displayName={t.authorName} size={14} />
                  )}
                </div>
                {/* HTML5 audio player — styled minimally */}
                <audio
                  src={t.url}
                  controls
                  preload="none"
                  className="w-full"
                  style={{ height: 28, opacity: 0.85 }}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <UploadZone
          spaceId={ctx.spaceId}
          moduleIndex={index}
          accept="audio/*"
          multiple
          onDone={() => {}}
        >
          <span className="mono text-[10px] tracking-widest opacity-60">♫ +</span>
        </UploadZone>
      </WidgetCard>
    </WidgetShell>
  );
}
