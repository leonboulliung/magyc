"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { newLocalId } from "@/lib/id";
import { useWidgetContext } from "@/lib/widgetContext";
import { useT } from "@/components/i18n/LocaleProvider";
import type { ModuleStateEntry, MoodboardDirectionStatus, MoodboardWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { IMAGE_ACCEPT, UploadZone } from "./UploadZone";
import { useInlineEdit } from "./useInlineEdit";
import { FullscreenOverlay } from "./FullscreenOverlay";
import { assetPathFromData, assetUrlFromData, useAssetUrls } from "./useAssetUrls";

const CAPTION_MAX = 280;

const STATUSES: readonly MoodboardDirectionStatus[] = ["reference", "approved", "avoid"];

function nextStatus(status: MoodboardDirectionStatus): MoodboardDirectionStatus {
  const idx = STATUSES.indexOf(status);
  return STATUSES[(idx + 1) % STATUSES.length] ?? "reference";
}

function statusLabel(status: MoodboardDirectionStatus): string {
  if (status === "approved") return "ok";
  if (status === "avoid") return "no-go";
  return "ref";
}

function statusTone(status: MoodboardDirectionStatus) {
  switch (status) {
    case "approved":
      return { border: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.10)" };
    case "avoid":
      return { border: "rgba(244,63,94,0.32)", background: "rgba(244,63,94,0.09)" };
    default:
      return { border: "var(--v-rule)", background: "rgba(255,255,255,0.04)" };
  }
}

interface DirectionView {
  key: string;
  label: string;
  note?: string;
  status: MoodboardDirectionStatus;
}

interface ImageView {
  key: string;
  url: string;
  name: string;
  caption: string;
}

/**
 * Horizontal rail helper — tracks whether the row can scroll left/right and
 * scrolls by ~a screenful, so the gallery navigates with arrows instead of a
 * native scrollbar (which overlapped the images).
 */
function useRail(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({
      left: el.scrollLeft > 4,
      right: el.scrollWidth - el.clientWidth - el.scrollLeft > 4,
    });
  }, []);
  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const by = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(220, el.clientWidth * 0.8), behavior: "smooth" });
  }, []);
  return { ref, edge, update, by };
}

function RailArrow({
  dir,
  onClick,
}: {
  dir: 1 | -1;
  onClick: () => void;
}) {
  const tr = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 1 ? tr.elements.next : tr.elements.prev}
      className={`absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[15px] leading-none text-white opacity-90 shadow-lg transition-opacity hover:opacity-100 ${dir === 1 ? "right-1.5" : "left-1.5"}`}
      style={{ background: "rgba(0,0,0,0.62)", border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(6px)" }}
    >
      {dir === 1 ? "›" : "‹"}
    </button>
  );
}

export function MoodboardRenderer({
  module: m,
  index,
  state,
}: {
  module: MoodboardWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const tr = useT();
  const directions = buildDirections(m, state);
  const assetPaths = state
    .filter((e) => e.kind === "upload")
    .map((e) => assetPathFromData(e.data))
    .filter(Boolean);
  const signedUrls = useAssetUrls(ctx.spaceId, assetPaths);

  // Per-image overlays live in the same module_state as edit-entries keyed
  // by the upload id: { id, caption } for a note, { id, deleted } to remove.
  const captions = new Map<string, string>();
  const imgDeleted = new Set<string>();
  for (const e of state) {
    if (e.kind !== "edit" || typeof e.data.id !== "string") continue;
    if (typeof e.data.caption === "string") captions.set(e.data.id, e.data.caption);
    if (e.data.deleted === true) imgDeleted.add(e.data.id);
  }

  const images: ImageView[] = state
    .filter((e) => e.kind === "upload" && typeof e.data.mimeType === "string" && (e.data.mimeType as string).startsWith("image/"))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      key: e.id,
      url: assetUrlFromData(e.data, signedUrls),
      name: typeof e.data.name === "string" ? (e.data.name as string) : "",
      caption: captions.get(e.id) ?? "",
    }))
    .filter((img) => img.url && !imgDeleted.has(img.key));

  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState("");
  const [expanded, setExpanded] = useState(false);

  // Side-scroll navigation for the compact gallery.
  const compactRail = useRail([images.length]);

  // Fullscreen is a centered one-image carousel: swipe or click to step
  // through, one image at a time, always centred.
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => { if (expanded) setActiveIndex(0); }, [expanded]);
  const imageCount = images.length;
  const safeIndex = imageCount ? Math.min(activeIndex, imageCount - 1) : 0;
  const goImage = useCallback(
    (delta: number) => setActiveIndex((i) => (imageCount ? (i + delta + imageCount) % imageCount : 0)),
    [imageCount],
  );
  const touchStartX = useRef<number | null>(null);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goImage(1);
      else if (e.key === "ArrowLeft") goImage(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, goImage]);

  async function updateDirection(
    key: string,
    patch: Partial<Pick<DirectionView, "label" | "note" | "status">>,
  ) {
    await ctx.act(index, "edit", { id: key, ...patch });
  }

  async function addDirection(keepOpen = false) {
    const label = pending.trim();
    setPending("");
    if (!label) {
      if (!keepOpen) setAdding(false);
      return;
    }
    if (!keepOpen) setAdding(false);
    await ctx.act(index, "add", { id: newLocalId("mood"), label, status: "reference" });
  }

  const setCaption = (key: string, caption: string) => ctx.act(index, "edit", { id: key, caption });
  const removeImage = (key: string) => ctx.act(index, "edit", { id: key, deleted: true });
  const deleteDirection = (key: string) => ctx.act(index, "edit", { id: key, deleted: true });

  const empty = images.length === 0 && directions.length === 0;

  return (
    <WidgetShell module={m} index={index}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {empty && (
          <p className="mono mb-2 pr-24 text-[11px] leading-relaxed opacity-50" style={{ color: "var(--v-muted)" }}>
            {m.placeholder ?? tr.elements.moodboardEmpty}
          </p>
        )}

        {/* Horizontal gallery: thumbnails + an inline upload tile, so adding
            an image feels like dropping it right next to the others. The row
            scrolls sideways — the board never grows tall. */}
        <div className="relative">
          <div
            ref={compactRail.ref}
            onScroll={compactRail.update}
            className="no-scrollbar -mx-1 flex items-start gap-2 overflow-x-auto px-1 py-0.5"
          >
            <AnimatePresence initial={false}>
              {images.map((img) => (
                <motion.figure
                  key={img.key}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="group/img relative m-0 h-32 w-32 shrink-0 overflow-hidden rounded-[var(--v-radius)]"
                  style={{ border: "1px solid var(--v-rule)" }}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="block h-full w-full"
                    title={img.caption || tr.elements.viewLarge}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                  </button>
                  {img.caption && (
                    <span
                      className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-md text-[11px] leading-none text-white"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                      title={tr.elements.hasNote}
                    >
                      ✎
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(img.key)}
                    aria-label={tr.elements.removeImage}
                    className="touch-visible mono absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] leading-none text-white opacity-0 transition-opacity group-hover/img:opacity-90 hover:!opacity-100"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    ×
                  </button>
                </motion.figure>
              ))}
            </AnimatePresence>
            <div className="shrink-0">
              <UploadZone spaceId={ctx.spaceId} moduleIndex={index} accept={IMAGE_ACCEPT} multiple tile>
                <span className="text-[20px] leading-none opacity-60">＋</span>
                <span className="mono tracking-widest opacity-60">{tr.elements.moodboardImages}</span>
                <span className="mono px-2 text-center text-[8px] leading-tight tracking-widest opacity-45">
                  JPG PNG WEBP HEIC · max. 50 MB
                </span>
              </UploadZone>
            </div>
          </div>
          {compactRail.edge.left && <RailArrow dir={-1} onClick={() => compactRail.by(-1)} />}
          {compactRail.edge.right && <RailArrow dir={1} onClick={() => compactRail.by(1)} />}
        </div>

        {/* Directions list. */}
        {directions.length > 0 && (
          <div className="mt-3 space-y-2">
            {directions.map((direction) => (
              <DirectionRow
                key={direction.key}
                direction={direction}
                onSave={(patch) => updateDirection(direction.key, patch)}
                onDelete={() => deleteDirection(direction.key)}
              />
            ))}
          </div>
        )}

        {/* Add a direction — directly under the list. */}
        {adding ? (
          <input
            autoFocus
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            onBlur={() => addDirection(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addDirection(true); }
              else if (e.key === "Escape") { setPending(""); setAdding(false); }
            }}
            maxLength={140}
            placeholder={tr.elements.moodboardDirectionPlaceholder}
            className="mt-2 w-full rounded-[var(--v-radius)] bg-transparent px-3 py-2 text-[13px] outline-none"
            style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
          />
        ) : (
          <div className="mt-2.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mono inline-flex items-center gap-1 text-[11px] tracking-widest opacity-75 transition-opacity hover:opacity-100"
              style={{ color: "var(--v-accent, var(--v-fg))" }}
            >
              {tr.elements.addMoodboardEntry}
            </button>
            {!empty && ctx.mode !== "preset" && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                title={tr.elements.viewFullscreen}
                className="mono ml-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] tracking-widest transition-colors hover:brightness-110"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
              >
                <span aria-hidden>⤢</span> {tr.common.fullscreen}
              </button>
            )}
          </div>
        )}
      </WidgetCard>

      {expanded && (
        <FullscreenOverlay title={(m.microTitle as string) || "Moodboard"} onClose={() => setExpanded(false)}>
          <div className="flex h-full flex-col">
            {/* Gallery — one centred image at a time; swipe or use the arrows
                (or ← → keys) to step through, one image per view. */}
            <div
              className="relative min-h-0 flex-1"
              onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
              onTouchEnd={(e) => {
                if (touchStartX.current === null) return;
                const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
                touchStartX.current = null;
                if (Math.abs(dx) > 40) goImage(dx < 0 ? 1 : -1);
              }}
            >
              {imageCount === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
                  <span className="mono text-[12px] opacity-50" style={{ color: "var(--v-muted)" }}>
                    Noch keine Bilder — lade welche hoch.
                  </span>
                  <UploadZone spaceId={ctx.spaceId} moduleIndex={index} accept={IMAGE_ACCEPT} multiple tile>
                    <span className="text-[20px] leading-none opacity-60">＋</span>
                    <span className="mono tracking-widest opacity-60">{tr.elements.moodboardImages}</span>
                    <span className="mono px-2 text-center text-[8px] leading-tight tracking-widest opacity-45">
                      JPG PNG WEBP HEIC · max. 50 MB
                    </span>
                  </UploadZone>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 py-6 sm:px-16">
                  <a
                    href={images[safeIndex]!.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex min-h-0 w-full flex-1 items-center justify-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={images[safeIndex]!.url}
                      alt={images[safeIndex]!.name}
                      className="max-h-full max-w-full rounded-[var(--v-radius)] object-contain"
                      style={{ border: "1px solid var(--v-rule)" }}
                    />
                  </a>
                  <div className="mt-3 w-full" style={{ maxWidth: 520 }}>
                    <ImageCaption value={images[safeIndex]!.caption} onSave={(c) => setCaption(images[safeIndex]!.key, c)} />
                  </div>
                  <div className="mono mt-2 text-[11px] tracking-widest opacity-50" style={{ color: "var(--v-muted)" }}>
                    {safeIndex + 1} / {imageCount}
                  </div>
                </div>
              )}
              {imageCount > 0 && (
                <div className="absolute bottom-4 left-4 z-10 w-24">
                  <UploadZone spaceId={ctx.spaceId} moduleIndex={index} accept={IMAGE_ACCEPT} multiple tile>
                    <span className="text-[16px] leading-none opacity-60">＋</span>
                    <span className="mono text-[9px] tracking-widest opacity-60">{tr.elements.moodboardImages}</span>
                  </UploadZone>
                </div>
              )}
              {imageCount > 1 && <RailArrow dir={-1} onClick={() => goImage(-1)} />}
              {imageCount > 1 && <RailArrow dir={1} onClick={() => goImage(1)} />}
            </div>

            {/* Refs / directions listed below the gallery. */}
            <div
              className="shrink-0 overflow-y-auto px-6 py-4 sm:px-10"
              style={{ borderTop: "1px solid var(--v-rule)", maxHeight: "34vh" }}
            >
              <div className="mx-auto max-w-3xl space-y-2">
                {directions.map((direction) => (
                  <DirectionRow
                    key={direction.key}
                    direction={direction}
                    expanded
                    onSave={(patch) => updateDirection(direction.key, patch)}
                    onDelete={() => deleteDirection(direction.key)}
                  />
                ))}
                {adding ? (
                  <input
                    autoFocus
                    value={pending}
                    onChange={(e) => setPending(e.target.value)}
                    onBlur={() => addDirection(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addDirection(true); }
                      else if (e.key === "Escape") { setPending(""); setAdding(false); }
                    }}
                    maxLength={140}
                    placeholder={tr.elements.moodboardDirectionPlaceholder}
                    className="w-full rounded-[var(--v-radius)] bg-transparent px-3 py-2 text-[13px] outline-none"
                    style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="mono inline-flex items-center gap-1 pt-1 text-[11px] tracking-widest opacity-75 transition-opacity hover:opacity-100"
                    style={{ color: "var(--v-accent, var(--v-fg))" }}
                  >
                    {tr.elements.addMoodboardEntry}
                  </button>
                )}
              </div>
            </div>
          </div>
        </FullscreenOverlay>
      )}
    </WidgetShell>
  );
}

/** Full-screen image caption — click to edit, wraps, capped length. */
function ImageCaption({
  value,
  onSave,
}: {
  value: string;
  onSave: (text: string) => void;
}) {
  const tr = useT();
  const edit = useInlineEdit<HTMLTextAreaElement>({
    value,
    onSave,
    submitOn: "modEnter",
    trim: true,
    autoGrow: true,
  });

  if (edit.editing) {
    return (
      <textarea
        {...edit.editProps}
        rows={1}
        maxLength={CAPTION_MAX}
        placeholder={tr.elements.imageNote}
        className="w-full resize-none rounded-[var(--v-radius)] px-3 py-2 text-center text-[13px] leading-relaxed outline-none"
        style={{ color: "var(--v-fg)", background: "var(--v-bg)", border: "1px solid var(--v-rule)" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => edit.setEditing(true)}
      className="block w-full whitespace-pre-wrap break-words px-3 py-1 text-center text-[13px] leading-relaxed"
      style={{ color: value ? "var(--v-fg)" : "var(--v-muted)" }}
    >
      {value || tr.elements.addDirection}
    </button>
  );
}

function DirectionRow({
  direction,
  onSave,
  onDelete,
  expanded = false,
}: {
  direction: DirectionView;
  onSave: (patch: Partial<Pick<DirectionView, "label" | "note" | "status">>) => void;
  onDelete: () => void;
  expanded?: boolean;
}) {
  const tr = useT();
  const labelEdit = useInlineEdit<HTMLTextAreaElement>({
    value: direction.label,
    onSave: (label) => onSave({ label }),
    submitOn: "enter",
    autoGrow: true,
  });
  const noteEdit = useInlineEdit<HTMLTextAreaElement>({
    value: direction.note ?? "",
    onSave: (note) => onSave({ note }),
    submitOn: "enter",
    trim: true,
    autoGrow: true,
  });
  const tone = statusTone(direction.status);

  return (
    <div
      className="group rounded-[var(--v-radius)] p-3"
      style={{ border: "1px solid var(--v-rule)", background: expanded ? "var(--v-bg)" : "rgba(255,255,255,0.02)" }}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => onSave({ status: nextStatus(direction.status) })}
          title="Status wechseln"
          className="mono mt-px shrink-0 rounded-full px-2 py-1 text-[9px] uppercase tracking-widest"
          style={{ border: `1px solid ${tone.border}`, background: tone.background, color: "var(--v-fg)" }}
        >
          {statusLabel(direction.status)}
        </button>

        <div className="min-w-0 flex-1">
          {labelEdit.editing ? (
            <textarea
              {...labelEdit.editProps}
              rows={1}
              maxLength={140}
              placeholder={tr.elements.nameDirection}
              className="w-full resize-none bg-transparent text-[13px] leading-snug outline-none placeholder:opacity-50"
              style={{ color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => labelEdit.setEditing(true)}
              className={`block w-full whitespace-pre-wrap break-words text-left text-[13px] leading-snug ${direction.label ? "" : "opacity-50"}`}
              style={{ color: direction.label ? "var(--v-fg)" : "var(--v-muted)" }}
            >
              {direction.label || tr.elements.nameDirection}
            </button>
          )}

          {noteEdit.editing ? (
            <textarea
              {...noteEdit.editProps}
              rows={1}
              maxLength={400}
              placeholder={tr.elements.urlOrNote}
              className="mt-1.5 w-full resize-none bg-transparent text-[12px] leading-snug outline-none placeholder:opacity-50"
              style={{ color: "var(--v-muted)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => noteEdit.setEditing(true)}
              className={`mt-1 block w-full whitespace-pre-wrap break-words text-left text-[12px] leading-snug ${direction.note ? "" : "opacity-50"}`}
              style={{ color: "var(--v-muted)" }}
            >
              {direction.note || tr.elements.urlOrNote}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onDelete}
          aria-label={tr.elements.remove}
          className="touch-visible mono mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] leading-none opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-50 hover:!opacity-100"
          style={{ color: "var(--v-muted)" }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function buildDirections(module: MoodboardWidget, state: ModuleStateEntry[]): DirectionView[] {
  const byId = new Map<string, DirectionView>();
  const deleted = new Set<string>();
  for (const e of state) {
    if (e.kind === "edit" && e.data.deleted === true && typeof e.data.id === "string") {
      deleted.add(e.data.id);
    }
  }

  module.directions.forEach((direction, i) => {
    byId.set(`seed-${i}`, {
      key: `seed-${i}`,
      label: cleanPlaceholder(direction.label),
      note: cleanPlaceholder(direction.note),
      status: direction.status ?? "reference",
    });
  });

  for (const e of state) {
    if (e.kind !== "add") continue;
    const id = typeof e.data.id === "string" ? e.data.id : e.id;
    const label = cleanPlaceholder(typeof e.data.label === "string" ? e.data.label : "");
    if (!label) continue;
    byId.set(id, {
      key: id,
      label,
      status: e.data.status === "approved" || e.data.status === "avoid" ? e.data.status : "reference",
    });
  }

  for (const e of state) {
    if (e.kind !== "edit") continue;
    const id = typeof e.data.id === "string" ? e.data.id : "";
    const current = byId.get(id);
    if (!current) continue;
    const status = e.data.status === "reference" || e.data.status === "approved" || e.data.status === "avoid"
      ? e.data.status
      : current.status;
    byId.set(id, {
      ...current,
      label: typeof e.data.label === "string" ? cleanPlaceholder(e.data.label) : current.label,
      note: typeof e.data.note === "string" ? cleanPlaceholder(e.data.note) : current.note,
      status,
    });
  }

  return Array.from(byId.values()).filter((d) => !deleted.has(d.key) && (d.label.trim() || d.note?.trim()));
}

function cleanPlaceholder(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "…" || text === "..." ? "" : text;
}
