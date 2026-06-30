"use client";

import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { AttachmentsWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";
import { ATTACHMENT_ACCEPT, UploadZone, fmtSize, uploadHintForAccept } from "./UploadZone";
import { assetPathFromData, assetUrlFromData, useAssetUrls } from "./useAssetUrls";

/**
 * Anhänge — catch-all file attachments. Anyone can upload; files are
 * grouped by kind (images → documents → media → other) so the most useful
 * land on top, and each can be removed. Uploads live in module_state as
 * `upload` rows; a delete is an `edit` carrying { id, deleted } (append-only
 * log, no extra route), the same pattern as Notes/Q&A.
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

  const uploads = state
    .filter((e) => e.kind === "upload" && !deleted.has(e.id))
    .map((e) => ({
      key: e.id,
      url: assetUrlFromData(e.data, signedUrls),
      name: typeof e.data.name === "string" ? (e.data.name as string) : "file",
      size: typeof e.data.size === "number" ? (e.data.size as number) : 0,
      mimeType: typeof e.data.mimeType === "string" ? (e.data.mimeType as string) : "",
      createdAt: e.createdAt,
      authorName: e.actor.displayName,
      authorColor: typeof e.data.color === "string" ? (e.data.color as string) : undefined,
    }))
    .filter((f) => f.url)
    // Group by kind (rank), newest first within a group.
    .sort((a, b) => kindRank(a.mimeType) - kindRank(b.mimeType) || b.createdAt - a.createdAt);

  async function remove(id: string) {
    await ctx.act(index, "edit", { id, deleted: true });
  }

  return (
    <WidgetShell module={m} index={index}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {uploads.length === 0 && (
          <p className="mono text-[11px] opacity-50 mb-3" style={{ color: "var(--v-muted)" }}>
            {m.placeholder ?? "Dateien hier ablegen oder hochladen."}
          </p>
        )}

        <ul className="space-y-1.5 mb-3">
          <AnimatePresence initial={false}>
            {uploads.map((f) => {
              const isImage = f.mimeType.startsWith("image/");
              return (
                <motion.li
                  key={f.key}
                  layout
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 3 }}
                  transition={{ duration: 0.15 }}
                  className="group/att flex items-center gap-2.5 py-1.5 px-1"
                  style={{ borderBottom: "1px solid var(--v-rule)" }}
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.url}
                      alt={f.name}
                      className="h-8 w-8 shrink-0 rounded-[var(--v-radius)] object-cover"
                      style={{ border: "1px solid var(--v-rule)" }}
                    />
                  ) : (
                    <span className="mono text-[13px] shrink-0" style={{ color: "var(--v-muted)" }}>
                      {fileEmoji(f.mimeType)}
                    </span>
                  )}
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex-1 min-w-0 truncate text-[12.5px] hover:underline"
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
                  <a
                    href={f.url}
                    download={f.name}
                    aria-label={`${f.name} herunterladen`}
                    className="mono shrink-0 rounded-full px-2 py-1 text-[9px] tracking-widest opacity-55 transition-opacity hover:opacity-100"
                    style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(f.key)}
                    aria-label="Anhang entfernen"
                    className="mono shrink-0 text-[13px] opacity-0 transition-opacity group-hover/att:opacity-50 hover:!opacity-100"
                    style={{ color: "var(--v-muted)" }}
                  >
                    ×
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        <UploadZone
          spaceId={ctx.spaceId}
          moduleIndex={index}
          accept={ATTACHMENT_ACCEPT}
          multiple
          onDone={() => {}}
        >
          <span className="mono text-[10px] tracking-widest opacity-60">↑ Datei hinzufügen</span>
          <span className="mono px-4 text-center text-[8px] leading-tight tracking-widest opacity-45">
            {uploadHintForAccept(ATTACHMENT_ACCEPT)}
          </span>
        </UploadZone>
      </WidgetCard>
    </WidgetShell>
  );
}

/** Group ordering: images first (most glanceable), then documents, then
 *  audio/video, then everything else. */
function kindRank(mime: string): number {
  if (mime.startsWith("image/")) return 0;
  if (mime === "application/pdf" || mime.startsWith("application/vnd") || mime === "application/msword" || mime.startsWith("text/")) return 1;
  if (mime.startsWith("audio/") || mime.startsWith("video/")) return 2;
  return 3;
}

function fileEmoji(mime: string): string {
  if (mime.startsWith("image/")) return "▨";
  if (mime.startsWith("audio/")) return "♫";
  if (mime.startsWith("video/")) return "▶";
  if (mime === "application/pdf") return "◇";
  if (mime.startsWith("text/")) return "≡";
  return "□";
}
