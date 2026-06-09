"use client";

import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { AttachmentsWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";
import { UploadZone, fmtSize } from "./UploadZone";

/**
 * Anhänge — file attachment widget. Anyone can upload; uploads are
 * stored in Supabase Storage and listed as download links. Each file
 * shows uploader attribution via ActorDot.
 */
export function AttachmentsRenderer({
  module: m,
  index,
  state,
}: {
  module: AttachmentsWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();

  const uploads = state
    .filter((e) => e.kind === "upload")
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      key: e.id,
      url: typeof e.data.url === "string" ? (e.data.url as string) : "",
      name: typeof e.data.name === "string" ? (e.data.name as string) : "file",
      size: typeof e.data.size === "number" ? (e.data.size as number) : 0,
      mimeType: typeof e.data.mimeType === "string" ? (e.data.mimeType as string) : "",
      authorName: e.actor.displayName,
      authorColor: typeof e.data.color === "string" ? (e.data.color as string) : undefined,
    }))
    .filter((f) => f.url);

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {uploads.length === 0 && (
          <p className="mono text-[11px] opacity-50 mb-3" style={{ color: "var(--v-muted)" }}>
            {m.placeholder ?? "…"}
          </p>
        )}

        <ul className="space-y-1.5 mb-3">
          <AnimatePresence initial={false}>
            {uploads.map((f) => (
              <motion.li
                key={f.key}
                layout
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 3 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2.5 py-1.5 px-1"
                style={{ borderBottom: "1px solid var(--v-rule)" }}
              >
                <span className="mono text-[13px] shrink-0" style={{ color: "var(--v-muted)" }}>
                  {fileEmoji(f.mimeType)}
                </span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex-1 min-w-0 text-[12.5px] hover:underline truncate"
                  style={{ color: "var(--v-fg)" }}
                >
                  {f.name}
                </a>
                {f.size > 0 && (
                  <span className="mono text-[9px] shrink-0" style={{ color: "var(--v-muted)" }}>
                    {fmtSize(f.size)}
                  </span>
                )}
                {f.authorName && (
                  <ActorDot color={f.authorColor} displayName={f.authorName} size={14} />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <UploadZone
          spaceId={ctx.spaceId}
          moduleIndex={index}
          accept="*/*"
          multiple
          onDone={() => ctx.refresh()}
        >
          <span className="mono text-[10px] tracking-widest opacity-60">↑</span>
        </UploadZone>
      </WidgetCard>
    </WidgetShell>
  );
}

function fileEmoji(mime: string): string {
  if (mime.startsWith("image/")) return "▨";
  if (mime.startsWith("audio/")) return "♫";
  if (mime.startsWith("video/")) return "▶";
  if (mime === "application/pdf") return "◇";
  if (mime.startsWith("text/")) return "≡";
  return "□";
}
