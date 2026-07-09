"use client";

import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { useT } from "@/components/i18n/LocaleProvider";
import type { AudioWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";
import { AUDIO_ACCEPT, UploadZone, fmtSize, uploadHintForAccept } from "./UploadZone";
import { assetPathFromData, assetUrlFromData, useAssetUrls } from "./useAssetUrls";

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
  const tr = useT();
  const assetPaths = state
    .filter((e) => e.kind === "upload")
    .map((e) => assetPathFromData(e.data))
    .filter(Boolean);
  const signedUrls = useAssetUrls(ctx.spaceId, assetPaths);

  const deleted = new Set(state
    .filter((entry) => entry.kind === "edit" && entry.data.deleted === true && typeof entry.data.id === "string")
    .map((entry) => entry.data.id as string));

  const tracks = state
    .filter((e) => e.kind === "upload" && typeof e.data.mimeType === "string" && (e.data.mimeType as string).startsWith("audio/"))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      key: e.id,
      url: assetUrlFromData(e.data, signedUrls),
      name: typeof e.data.name === "string" ? (e.data.name as string) : "audio",
      size: typeof e.data.size === "number" ? (e.data.size as number) : 0,
      authorName: e.actor.displayName,
      authorColor: typeof e.data.color === "string" ? (e.data.color as string) : undefined,
    }))
    .filter((t) => t.url && !deleted.has(t.key));

  async function removeTrack(id: string) {
    await ctx.act(index, "edit", { id, deleted: true });
  }

  return (
    <WidgetShell module={m} index={index}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {tracks.length === 0 && (
          <p className="mono text-[11px] opacity-50 mb-3" style={{ color: "var(--v-muted)" }}>
            {m.placeholder ?? tr.elements.audioEmpty}
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
                  <button
                    type="button"
                    onClick={() => removeTrack(t.key)}
                    aria-label={`${t.name} ${tr.elements.remove}`}
                    className="mono grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] opacity-45 transition-opacity hover:opacity-100"
                    style={{ border: "1px solid var(--v-rule)", color: "var(--v-muted)" }}
                  >
                    ×
                  </button>
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
          accept={AUDIO_ACCEPT}
          multiple
          onDone={() => {}}
        >
          <span className="mono text-[10px] tracking-widest opacity-60">{tr.elements.addAudio}</span>
          <span className="mono px-4 text-center text-[8px] leading-tight tracking-widest opacity-45">
            {uploadHintForAccept(AUDIO_ACCEPT)}
          </span>
        </UploadZone>
      </WidgetCard>
    </WidgetShell>
  );
}
