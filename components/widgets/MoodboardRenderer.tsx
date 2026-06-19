"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { newLocalId } from "@/lib/id";
import { useWidgetContext } from "@/lib/widgetContext";
import type { ModuleStateEntry, MoodboardDirectionStatus, MoodboardWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { UploadZone } from "./UploadZone";
import { useInlineEdit } from "./useInlineEdit";
import { FullscreenOverlay } from "./FullscreenOverlay";

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
  const directions = buildDirections(m, state);

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
      url: typeof e.data.url === "string" ? (e.data.url as string) : "",
      name: typeof e.data.name === "string" ? (e.data.name as string) : "",
      caption: captions.get(e.id) ?? "",
    }))
    .filter((img) => img.url && !imgDeleted.has(img.key));

  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState("");
  const [expanded, setExpanded] = useState(false);

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

  const hasContent = images.length > 0 || directions.length > 0;

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description} bare>
        {/* Image grid (square crops for a tidy board; click to view true
            format). Top padding clears the hover toolbar. */}
        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-1 p-1 pt-10 sm:grid-cols-3">
            <AnimatePresence initial={false}>
              {images.map((img) => (
                <motion.figure
                  key={img.key}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="group/img relative m-0 flex flex-col overflow-hidden rounded-[var(--v-radius)]"
                  style={{ border: "1px solid var(--v-rule)" }}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
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
                  <ImageCaption value={img.caption} onSave={(c) => setCaption(img.key, c)} />
                </motion.figure>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <p className="mono px-4 pb-1 pt-10 pr-24 text-[11px] opacity-50" style={{ color: "var(--v-muted)" }}>
            {m.placeholder ?? "Noch keine Referenzen — lade Bilder hoch oder ergänze Richtungen."}
          </p>
        )}

        {/* Directions: status pill + short label + optional note/URL. */}
        <div className="space-y-2 px-4 py-3">
          {directions.map((direction) => (
            <DirectionRow
              key={direction.key}
              direction={direction}
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
              placeholder="z. B. Warmes, gerichtetes Seitenlicht — Enter für weitere"
              className="w-full rounded-[var(--v-radius)] bg-transparent px-2 py-1 text-[13px] outline-none"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mono rounded-full px-3 py-1 text-[10px] tracking-widest opacity-60 transition-opacity hover:opacity-100"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              + Richtung
            </button>
          )}
        </div>

        {/* Compact actions: upload + (when there's content) a fullscreen view. */}
        <div className="flex items-center gap-2 px-3 pb-3">
          <UploadZone spaceId={ctx.spaceId} moduleIndex={index} accept="image/*" multiple compact>
            <span className="mono tracking-widest opacity-70">▧ Bilder</span>
          </UploadZone>
          {hasContent && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              title="Vollbild"
              className="mono flex h-9 items-center rounded-[var(--v-radius)] px-3 text-[11px] tracking-widest opacity-70 transition-opacity hover:opacity-100"
              style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
            >
              ⤢ Vollbild
            </button>
          )}
        </div>
      </WidgetCard>

      {expanded && (
        <FullscreenOverlay title={(m.microTitle as string) || "Moodboard"} onClose={() => setExpanded(false)}>
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8">
            {images.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {images.map((img) => (
                  <figure
                    key={img.key}
                    className="m-0 overflow-hidden rounded-[var(--v-radius)]"
                    style={{ border: "1px solid var(--v-rule)", background: "var(--v-bg)" }}
                  >
                    <a href={img.url} target="_blank" rel="noreferrer noopener" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.name}
                        className="mx-auto block max-h-[70vh] w-full object-contain"
                      />
                    </a>
                    <ImageCaption value={img.caption} onSave={(c) => setCaption(img.key, c)} expanded />
                  </figure>
                ))}
              </div>
            )}

            {directions.length > 0 && (
              <div className="mt-6 space-y-2">
                {directions.map((direction) => (
                  <DirectionRow
                    key={direction.key}
                    direction={direction}
                    expanded
                    onSave={(patch) => updateDirection(direction.key, patch)}
                    onDelete={() => deleteDirection(direction.key)}
                  />
                ))}
              </div>
            )}

            <div className="mt-6">
              <UploadZone spaceId={ctx.spaceId} moduleIndex={index} accept="image/*" multiple compact>
                <span className="mono tracking-widest opacity-70">▧ Bilder hinzufügen</span>
              </UploadZone>
            </div>
          </div>
        </FullscreenOverlay>
      )}
    </WidgetShell>
  );
}

function ImageCaption({
  value,
  onSave,
  expanded = false,
}: {
  value: string;
  onSave: (text: string) => void;
  expanded?: boolean;
}) {
  const edit = useInlineEdit<HTMLTextAreaElement>({
    value,
    onSave,
    submitOn: expanded ? "modEnter" : "enter",
    trim: true,
    autoGrow: true,
  });

  if (edit.editing) {
    return (
      <textarea
        {...edit.editProps}
        rows={1}
        maxLength={CAPTION_MAX}
        placeholder="Notiz zum Bild …"
        className="w-full resize-none bg-[#181818] px-2 py-1.5 text-[11px] leading-relaxed outline-none"
        style={{ color: "var(--v-fg)", borderTop: "1px solid var(--v-rule)" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => edit.setEditing(true)}
      className={`block w-full px-2 py-1.5 text-left text-[11px] leading-relaxed ${expanded ? "whitespace-pre-wrap" : "truncate"}`}
      style={{
        color: value ? "var(--v-fg)" : "var(--v-muted)",
        background: "#181818",
        borderTop: "1px solid var(--v-rule)",
      }}
    >
      {value || "+ Notiz"}
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
      className="group relative rounded-[var(--v-radius)] p-2.5 pr-9"
      style={{ border: "1px solid var(--v-rule)", background: expanded ? "var(--v-bg)" : "#181818" }}
    >
      <button
        type="button"
        onClick={onDelete}
        aria-label="entfernen"
        className="mono absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] leading-none opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-60 hover:!opacity-100"
        style={{ color: "var(--v-muted)" }}
      >
        ×
      </button>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onSave({ status: nextStatus(direction.status) })}
          className="mono mt-0.5 shrink-0 rounded-full px-2 py-1 text-[9px] uppercase tracking-widest"
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
              className="w-full resize-none bg-transparent text-[13px] leading-relaxed outline-none"
              style={{ color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => labelEdit.setEditing(true)}
              className="block w-full whitespace-pre-wrap break-words text-left text-[13px] leading-relaxed"
              style={{ color: "var(--v-fg)" }}
            >
              {direction.label}
            </button>
          )}

          {noteEdit.editing ? (
            <textarea
              {...noteEdit.editProps}
              rows={1}
              maxLength={400}
              placeholder="URL oder Notiz …"
              className="mt-1 w-full resize-none bg-transparent text-[12px] leading-relaxed outline-none"
              style={{ color: "var(--v-muted)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => noteEdit.setEditing(true)}
              className="mt-1 block min-h-[16px] w-full whitespace-pre-wrap break-words text-left text-[12px] leading-relaxed"
              style={{ color: direction.note ? "var(--v-muted)" : "var(--v-rule)" }}
            >
              {direction.note || "URL oder Notiz …"}
            </button>
          )}
        </div>
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
      label: direction.label,
      note: direction.note,
      status: direction.status ?? "reference",
    });
  });

  for (const e of state) {
    if (e.kind !== "add") continue;
    const id = typeof e.data.id === "string" ? e.data.id : e.id;
    const label = typeof e.data.label === "string" ? e.data.label : "";
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
      label: typeof e.data.label === "string" ? e.data.label : current.label,
      note: typeof e.data.note === "string" ? e.data.note : current.note,
      status,
    });
  }

  return Array.from(byId.values()).filter((d) => !deleted.has(d.key));
}
