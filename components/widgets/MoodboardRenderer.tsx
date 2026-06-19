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

const STATUSES: readonly MoodboardDirectionStatus[] = ["reference", "approved", "avoid"];

function nextStatus(status: MoodboardDirectionStatus): MoodboardDirectionStatus {
  const idx = STATUSES.indexOf(status);
  return STATUSES[(idx + 1) % STATUSES.length] ?? "reference";
}

function statusLabel(status: MoodboardDirectionStatus, language: string): string {
  const de = language.toLowerCase().startsWith("de");
  if (status === "approved") return de ? "ok" : "ok";
  if (status === "avoid") return de ? "no-go" : "avoid";
  return de ? "ref" : "ref";
}

function statusTone(status: MoodboardDirectionStatus) {
  switch (status) {
    case "approved":
      return { border: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.10)" };
    case "avoid":
      return { border: "rgba(244,63,94,0.32)", background: "rgba(244,63,94,0.09)" };
    default:
      return { border: "var(--v-rule)", background: "rgba(255,255,255,0.45)" };
  }
}

interface DirectionView {
  key: string;
  label: string;
  note?: string;
  status: MoodboardDirectionStatus;
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

  // Per-image overlays live in the same module_state as edit-entries keyed by
  // the upload id: { id, caption } for a note, { id, deleted } to remove it.
  const captions = new Map<string, string>();
  const imgDeleted = new Set<string>();
  for (const e of state) {
    if (e.kind !== "edit" || typeof e.data.id !== "string") continue;
    if (typeof e.data.caption === "string") captions.set(e.data.id, e.data.caption);
    if (e.data.deleted === true) imgDeleted.add(e.data.id);
  }

  const images = state
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
    await ctx.act(index, "add", {
      id: newLocalId("mood"),
      label,
      status: "reference",
    });
  }

  async function deleteDirection(key: string) {
    await ctx.act(index, "edit", { id: key, deleted: true });
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description} bare>
        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-1 p-1 sm:grid-cols-3">
            <AnimatePresence initial={false}>
              {images.map((img) => (
                <motion.figure
                  key={img.key}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="group/img relative m-0 overflow-hidden rounded-[var(--v-radius)]"
                  style={{ border: "1px solid var(--v-rule)" }}
                >
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block overflow-hidden"
                    style={{ aspectRatio: "1 / 1" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                  </a>
                  <button
                    type="button"
                    onClick={() => ctx.act(index, "edit", { id: img.key, deleted: true })}
                    aria-label="remove image"
                    className="mono absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] leading-none text-white opacity-0 transition-opacity group-hover/img:opacity-90 hover:!opacity-100"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    ×
                  </button>
                  <ImageCaption
                    value={img.caption}
                    onSave={(caption) => ctx.act(index, "edit", { id: img.key, caption })}
                  />
                </motion.figure>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="px-4 pb-2">
            <p className="mono text-[11px] opacity-50" style={{ color: "var(--v-muted)" }}>
              {m.placeholder ?? "Noch keine Referenzen — lade Bilder hoch oder ergänze Richtungen."}
            </p>
          </div>
        )}

        <div className="space-y-2 px-4 py-3">
          {directions.map((direction) => (
            <DirectionRow
              key={direction.key}
              direction={direction}
              language={ctx.language}
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
              placeholder="Richtung eingeben, Enter für weitere …"
              className="w-full bg-transparent px-2 py-1 text-[13px] outline-none rounded-[var(--v-radius)]"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="add"
              className="mono rounded-full px-3 py-1 text-[10px] tracking-widest opacity-60 transition-opacity hover:opacity-100"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              +
            </button>
          )}
        </div>

        <div className="px-3 pb-3">
          <UploadZone
            spaceId={ctx.spaceId}
            moduleIndex={index}
            accept="image/*"
            multiple
            onDone={() => {}}
          >
            <span className="mono text-[10px] tracking-widest opacity-60">▧ +</span>
          </UploadZone>
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

function ImageCaption({
  value,
  onSave,
}: {
  value: string;
  onSave: (text: string) => void;
}) {
  const edit = useInlineEdit<HTMLInputElement>({
    value,
    onSave,
    submitOn: "enter",
    trim: true,
  });

  if (edit.editing) {
    return (
      <input
        {...edit.editProps}
        maxLength={160}
        placeholder="Notiz zum Bild …"
        className="w-full bg-[#181818] px-2 py-1.5 text-[11px] outline-none"
        style={{ color: "var(--v-fg)", borderTop: "1px solid var(--v-rule)" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => edit.setEditing(true)}
      className="block w-full truncate px-2 py-1.5 text-left text-[11px]"
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
  language,
  onSave,
  onDelete,
}: {
  direction: DirectionView;
  language: string;
  onSave: (patch: Partial<Pick<DirectionView, "label" | "note" | "status">>) => void;
  onDelete: () => void;
}) {
  const labelEdit = useInlineEdit<HTMLInputElement>({
    value: direction.label,
    onSave: (label) => onSave({ label }),
    submitOn: "enter",
  });
  const noteEdit = useInlineEdit<HTMLInputElement>({
    value: direction.note ?? "",
    onSave: (note) => onSave({ note }),
    submitOn: "enter",
    trim: true,
  });
  const tone = statusTone(direction.status);

  return (
    <div
      className="group relative rounded-[var(--v-radius)] p-2.5"
      style={{ border: "1px solid var(--v-rule)", background: "#181818" }}
    >
      <button
        type="button"
        onClick={onDelete}
        aria-label="remove"
        className="mono absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] leading-none opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-60 hover:!opacity-100"
        style={{ color: "var(--v-muted)" }}
      >
        ×
      </button>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onSave({ status: nextStatus(direction.status) })}
          className="mono shrink-0 rounded-full px-2 py-1 text-[9px] uppercase tracking-widest"
          style={{ border: `1px solid ${tone.border}`, background: tone.background, color: "var(--v-fg)" }}
        >
          {statusLabel(direction.status, language)}
        </button>
        <div className="min-w-0 flex-1">
          {labelEdit.editing ? (
            <input
              {...labelEdit.editProps}
              maxLength={140}
              className="w-full bg-transparent text-[13px] outline-none"
              style={{ color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => labelEdit.setEditing(true)}
              className="block w-full truncate text-left text-[13px]"
              style={{ color: "var(--v-fg)" }}
            >
              {direction.label}
            </button>
          )}

          {noteEdit.editing ? (
            <input
              {...noteEdit.editProps}
              maxLength={240}
              className="mt-1 w-full bg-transparent text-[12px] outline-none"
              style={{ color: "var(--v-muted)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => noteEdit.setEditing(true)}
              className="mt-1 block min-h-[16px] w-full truncate text-left text-[12px]"
              style={{ color: direction.note ? "var(--v-muted)" : "var(--v-rule)" }}
            >
              {direction.note || "..."}
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
