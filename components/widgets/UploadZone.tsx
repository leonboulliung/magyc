"use client";

import { useRef, useState } from "react";
import { getAnonToken, getAnonDisplayName } from "@/lib/anonId";
import {
  readApiJson,
  showActionError,
  showActionLoading,
  showActionSuccess,
  showApiError,
  showUnknownError,
} from "@/lib/client/feedback";

/**
 * Hard client-side ceiling. The API allows 50 MB, but the deploy platform
 * rejects request bodies above ~4.5 MB *before* the handler runs — which
 * surfaced as a reasonless "upload failed". We check here so the user gets
 * a concrete reason (and which file) instead.
 */
const DEFAULT_MAX_MB = 4.5;

/**
 * Shared upload affordance used by Attachments, Images, and Audio
 * widgets. Handles drag-and-drop + click-to-pick, POSTs to the upload
 * endpoint, and calls onDone(url, name, size, mimeType) on success.
 *
 * The parent controls what MIME types are accepted. The component
 * shows a minimal dashed drop zone that expands on drag-over.
 */
export function UploadZone({
  spaceId,
  moduleIndex,
  accept,
  multiple = true,
  maxSizeMb = DEFAULT_MAX_MB,
  compact = false,
  tile = false,
  onDone,
  children,
}: {
  spaceId: string;
  moduleIndex: number;
  /** MIME type string for <input accept> and validation. */
  accept: string;
  multiple?: boolean;
  /** Per-file ceiling in MB. Files above this are rejected client-side
   *  with a concrete message before the request is sent. */
  maxSizeMb?: number;
  /** Compact: a small inline pill instead of the large full-width drop
   *  field. Used where the gallery already carries the visual weight. */
  compact?: boolean;
  /** Tile: a square drop target sized like a gallery thumbnail, so it can
   *  sit inline next to images as an "add" cell. */
  tile?: boolean;
  onDone?: (files: { url: string; name: string; size: number; mimeType: string }[]) => void;
  /** Slot for custom idle UI inside the zone. */
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function uploadFiles(incoming: File[]) {
    if (!incoming.length || busy) return;
    const toastId = `upload-${spaceId}-${moduleIndex}`;
    setBusy(true);

    // Compress images first (downscale + re-encode off the main thread). This
    // shrinks large camera files under the platform body limit and makes
    // multi-image uploads reliable. Non-images / undecodable files pass through.
    const hasImage = incoming.some((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (hasImage) {
      showActionLoading(incoming.length === 1 ? "Bild wird vorbereitet …" : "Bilder werden vorbereitet …", toastId);
      const { compressImageFile } = await import("@/lib/client/imageCompress");
      const prepared: File[] = [];
      for (const f of incoming) prepared.push(await compressImageFile(f));
      incoming = prepared;
    }

    // Reject anything still oversized with a concrete reason, then upload the rest.
    const limit = maxSizeMb * 1024 * 1024;
    const tooBig = incoming.filter((f) => f.size > limit);
    const files = incoming.filter((f) => f.size <= limit);
    if (tooBig.length) {
      const names = tooBig.map((f) => `${f.name} (${fmtSize(f.size)})`).join(", ");
      const message = `Zu groß: ${names}. Maximal ${maxSizeMb} MB pro Datei.`;
      showActionError("Datei zu groß", { id: toastId, description: message });
      setError(message);
    }
    if (!files.length) { setBusy(false); return; }

    if (!tooBig.length) setError("");
    const results: { url: string; name: string; size: number; mimeType: string }[] = [];
    showActionLoading(files.length === 1 ? "Datei wird hochgeladen …" : "Dateien werden hochgeladen …", toastId);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("moduleIndex", String(moduleIndex));
      fd.append("anonToken", getAnonToken());
      fd.append("anonName", getAnonDisplayName());
      try {
        const res = await fetch(`/api/spaces/${spaceId}/upload`, {
          method: "POST",
          body: fd,
        });
        const json = await readApiJson(res);
        if (res.ok && json.url) {
          results.push({
            url: String(json.url),
            name: typeof json.name === "string" ? json.name : file.name,
            size: typeof json.size === "number" ? json.size : file.size,
            mimeType: typeof json.mimeType === "string" ? json.mimeType : file.type,
          });
        } else {
          const message = showApiError("Upload fehlgeschlagen", json, {
            id: toastId,
            fallback: `${file.name} konnte nicht hochgeladen werden.`,
          });
          setError(message);
        }
      } catch (error) {
        const message = showUnknownError("Upload fehlgeschlagen", error, {
          id: toastId,
          fallback: `${file.name} konnte nicht hochgeladen werden.`,
        });
        setError(message);
      }
    }
    setBusy(false);
    if (results.length > 0) {
      showActionSuccess(results.length === 1 ? "Datei hochgeladen" : "Dateien hochgeladen", {
        id: toastId,
      });
      onDone?.(results);
    }
  }

  return (
    <div
      className="relative"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        uploadFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) uploadFiles(files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`rounded-[var(--v-radius)] transition-colors flex items-center justify-center gap-2 ${
          tile
            ? "h-32 w-32 shrink-0 flex-col text-[11px]"
            : compact
              ? "px-3 py-2 text-[11px]"
              : "w-full flex-col py-5"
        }`}
        style={{
          border: `1px dashed ${dragging ? "var(--v-fg)" : "var(--v-rule)"}`,
          background: dragging ? "rgba(255,255,255,0.04)" : "transparent",
          cursor: busy ? "wait" : "pointer",
          color: "var(--v-muted)",
          // Force the square thumbnail shape so the tile can never collapse
          // into a small rounded pill (which read as a circle next to images).
          ...(tile ? { width: "8rem", height: "8rem", borderRadius: "var(--v-radius)" } : null),
        }}
      >
        {busy ? (
          <span className="mono text-[12px] tracking-widest">…</span>
        ) : children ? (
          children
        ) : (
          <span className="mono text-[10px] tracking-widest opacity-70">+</span>
        )}
      </button>
      {error && (
        <span className="mono text-[9px] tracking-widest opacity-70 mt-1 block">{error}</span>
      )}
    </div>
  );
}

/** Format a file size (bytes) as a human-readable string. */
export function fmtSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
