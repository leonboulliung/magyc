"use client";

import { useRef, useState } from "react";
import { getAnonToken, getAnonDisplayName } from "@/lib/anonId";
import {
  readApiJson,
  showActionLoading,
  showActionSuccess,
  showApiError,
  showUnknownError,
} from "@/lib/client/feedback";

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
  onDone,
  children,
}: {
  spaceId: string;
  moduleIndex: number;
  /** MIME type string for <input accept> and validation. */
  accept: string;
  multiple?: boolean;
  onDone?: (files: { url: string; name: string; size: number; mimeType: string }[]) => void;
  /** Slot for custom idle UI inside the zone. */
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function uploadFiles(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setError("");
    const results: { url: string; name: string; size: number; mimeType: string }[] = [];
    const toastId = `upload-${spaceId}-${moduleIndex}`;
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
        className="w-full rounded-[var(--v-radius)] transition-colors flex flex-col items-center justify-center gap-2 py-5"
        style={{
          border: `1px dashed ${dragging ? "var(--v-fg)" : "var(--v-rule)"}`,
          background: dragging ? "rgba(0,0,0,0.02)" : "transparent",
          cursor: busy ? "wait" : "pointer",
          color: "var(--v-muted)",
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
