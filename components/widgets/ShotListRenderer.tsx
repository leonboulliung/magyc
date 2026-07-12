"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { newLocalId } from "@/lib/id";
import { useWidgetContext } from "@/lib/widgetContext";
import { useT } from "@/components/i18n/LocaleProvider";
import type { ModuleStateEntry, ShotListWidget, ShotPriority, ShotStatus } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { useInlineEdit } from "./useInlineEdit";

const STATUSES: readonly ShotStatus[] = ["planned", "captured", "selected"];
const PRIORITIES: readonly ShotPriority[] = ["must", "should", "nice"];

function nextStatus(status: ShotStatus): ShotStatus {
  const idx = STATUSES.indexOf(status);
  return STATUSES[(idx + 1) % STATUSES.length] ?? "planned";
}

function nextPriority(priority: ShotPriority): ShotPriority {
  const idx = PRIORITIES.indexOf(priority);
  return PRIORITIES[(idx + 1) % PRIORITIES.length] ?? "must";
}

function statusLabel(status: ShotStatus, language: string): string {
  const de = language.toLowerCase().startsWith("de");
  if (status === "captured") return de ? "im Kasten" : "captured"; // i18n-ignore: project-language content
  if (status === "selected") return de ? "select" : "selected";
  return de ? "geplant" : "planned";
}

function priorityLabel(priority: ShotPriority, language: string): string {
  const de = language.toLowerCase().startsWith("de");
  if (priority === "nice") return de ? "nice" : "nice";
  if (priority === "should") return de ? "soll" : "should";
  return de ? "muss" : "must";
}

function statusTone(status: ShotStatus) {
  switch (status) {
    case "captured":
      return { border: "rgba(59,130,246,0.32)", background: "rgba(59,130,246,0.10)" };
    case "selected":
      return { border: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.10)" };
    default:
      return { border: "var(--v-rule)", background: "transparent" };
  }
}

interface ShotView {
  key: string;
  label: string;
  purpose?: string;
  setup?: string;
  location?: string;
  notes?: string;
  priority: ShotPriority;
  status: ShotStatus;
}

export function ShotListRenderer({
  module: m,
  index,
  state,
}: {
  module: ShotListWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const tr = useT();
  const shots = buildShots(m, state);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState("");

  async function updateShot(
    key: string,
    patch: Partial<Pick<ShotView, "label" | "purpose" | "setup" | "location" | "notes" | "priority" | "status">>,
  ) {
    await ctx.act(index, "edit", { id: key, ...patch });
  }

  async function addShot(keepOpen = false) {
    const label = pending.trim();
    setPending("");
    if (!label) {
      if (!keepOpen) setAdding(false);
      return;
    }
    if (!keepOpen) setAdding(false);
    await ctx.act(index, "add", {
      id: newLocalId("shot"),
      label,
      priority: "must",
      status: "planned",
    });
  }

  async function deleteShot(key: string) {
    await ctx.act(index, "edit", { id: key, deleted: true });
  }

  return (
    <WidgetShell
      module={m}
      index={index}
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {shots.map((shot, order) => (
              <motion.div
                key={shot.key}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.16 }}
              >
                <ShotRow
                  shot={shot}
                  order={order}
                  language={ctx.language}
                  onSave={(patch) => updateShot(shot.key, patch)}
                  onDelete={() => deleteShot(shot.key)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-3">
          {adding ? (
            <input
              autoFocus
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              onBlur={() => addShot(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addShot(true); }
                else if (e.key === "Escape") { setPending(""); setAdding(false); }
              }}
              maxLength={160}
              placeholder={tr.elements.shotSubjectPlaceholder}
              className="w-full bg-transparent px-2 py-1 text-[13px] outline-none rounded-[var(--v-radius)]"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label={tr.elements.addPartsEntry}
              className="mono rounded-full px-3 py-1 text-[10px] tracking-widest opacity-70 transition-opacity hover:opacity-100"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              {tr.elements.addEntry}
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

function ShotRow({
  shot,
  order,
  language,
  onSave,
  onDelete,
}: {
  shot: ShotView;
  order: number;
  language: string;
  onSave: (patch: Partial<Pick<ShotView, "label" | "purpose" | "setup" | "location" | "notes" | "priority" | "status">>) => void;
  onDelete: () => void;
}) {
  const tr = useT();
  const titleEdit = useInlineEdit<HTMLTextAreaElement>({
    value: shot.label,
    onSave: (label) => onSave({ label }),
    submitOn: "enter",
    autoGrow: true,
  });
  const purposeEdit = useInlineEdit<HTMLTextAreaElement>({
    value: shot.purpose ?? "",
    onSave: (purpose) => onSave({ purpose }),
    submitOn: "enter",
    autoGrow: true,
  });
  const setupEdit = useInlineEdit<HTMLTextAreaElement>({
    value: shot.setup ?? "",
    onSave: (setup) => onSave({ setup }),
    submitOn: "enter",
    autoGrow: true,
  });
  const locationEdit = useInlineEdit<HTMLTextAreaElement>({
    value: shot.location ?? "",
    onSave: (location) => onSave({ location }),
    submitOn: "enter",
    autoGrow: true,
  });
  const tone = statusTone(shot.status);

  return (
    <div
      className="group relative rounded-[var(--v-radius)] p-3"
      style={{
        border: "1px solid var(--v-rule)",
        background: "var(--v-card)",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.08)",
      }}
    >
      <button
        type="button"
        onClick={onDelete}
        aria-label={tr.elements.removeShot}
        className="touch-visible mono absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[12px] leading-none opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-60 hover:!opacity-100"
        style={{ color: "var(--v-muted)" }}
      >
        ×
      </button>
      <div className="flex items-start gap-3">
        <div
          className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums"
          style={{ border: "1px solid var(--v-rule)", color: "var(--v-muted)" }}
        >
          {String(order + 1).padStart(2, "0")}
        </div>

        <div className="min-w-0 flex-1 pr-6">
          <div className="flex flex-wrap items-start gap-2">
            <button
              type="button"
              onClick={() => onSave({ status: nextStatus(shot.status) })}
              className="mono rounded-full px-2 py-1 text-[9px] uppercase tracking-widest"
              style={{ border: `1px solid ${tone.border}`, background: tone.background, color: "var(--v-fg)" }}
            >
              {statusLabel(shot.status, language)}
            </button>
            <button
              type="button"
              onClick={() => onSave({ priority: nextPriority(shot.priority) })}
              className="mono rounded-full px-2 py-1 text-[9px] uppercase tracking-widest"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-muted)" }}
            >
              {priorityLabel(shot.priority, language)}
            </button>
          </div>

          <InlineField
            edit={titleEdit}
            value={shot.label}
            placeholder={tr.elements.nameShotSubject}
            className="mt-2 text-[14px] font-medium"
          />

          <div className="mt-2 grid gap-x-3 gap-y-1.5 sm:grid-cols-3">
            <InlineField edit={purposeEdit} value={shot.purpose ?? ""} label="Zweck" mono />
            <InlineField edit={setupEdit} value={shot.setup ?? ""} label="Setup / Licht" mono />
            <InlineField edit={locationEdit} value={shot.location ?? ""} label={tr.elements.placeColumn} mono />
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineField({
  edit,
  value,
  placeholder,
  label,
  className = "text-[12px]",
  mono = false,
}: {
  edit: ReturnType<typeof useInlineEdit<HTMLTextAreaElement>>;
  value: string;
  /** Placeholder when there is no label (e.g. the title field). */
  placeholder?: string;
  /** Small caption above the field; doubles as the placeholder. */
  label?: string;
  className?: string;
  mono?: boolean;
}) {
  const ph = placeholder ?? (label ? `${label} …` : "…");
  const fieldClass = mono ? "mono text-[11px]" : className;
  return (
    <div className="min-w-0">
      {label && (
        <div className="mono mb-0.5 text-[8px] uppercase tracking-widest opacity-40" style={{ color: "var(--v-muted)" }}>
          {label}
        </div>
      )}
      {edit.editing ? (
        <textarea
          {...edit.editProps}
          rows={1}
          maxLength={400}
          placeholder={ph}
          className={`w-full resize-none bg-transparent leading-relaxed outline-none ${fieldClass}`}
          style={{ color: "var(--v-fg)" }}
        />
      ) : (
        <button
          type="button"
          onClick={() => edit.setEditing(true)}
          className={`block min-h-[16px] w-full whitespace-pre-wrap break-words text-left leading-relaxed [overflow-wrap:anywhere] ${fieldClass}`}
          style={{ color: value ? "var(--v-fg)" : "var(--v-muted)" }}
        >
          {value || (label ? "—" : ph)}
        </button>
      )}
    </div>
  );
}

function buildShots(module: ShotListWidget, state: ModuleStateEntry[]): ShotView[] {
  const byId = new Map<string, ShotView>();
  const deleted = new Set<string>();
  for (const e of state) {
    if (e.kind === "edit" && e.data.deleted === true && typeof e.data.id === "string") {
      deleted.add(e.data.id);
    }
  }

  module.shots.forEach((shot, i) => {
    byId.set(`seed-${i}`, {
      key: `seed-${i}`,
      label: cleanPlaceholder(shot.label),
      purpose: cleanPlaceholder(shot.purpose),
      setup: cleanPlaceholder(shot.setup),
      location: cleanPlaceholder(shot.location),
      notes: cleanPlaceholder(shot.notes),
      priority: shot.priority ?? "must",
      status: shot.status ?? "planned",
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
      purpose: typeof e.data.purpose === "string" ? e.data.purpose : undefined,
      setup: typeof e.data.setup === "string" ? e.data.setup : undefined,
      location: typeof e.data.location === "string" ? e.data.location : undefined,
      notes: typeof e.data.notes === "string" ? e.data.notes : undefined,
      priority: asPriority(e.data.priority),
      status: asStatus(e.data.status),
    });
  }

  for (const e of state) {
    if (e.kind !== "edit") continue;
    const id = typeof e.data.id === "string" ? e.data.id : "";
    const current = byId.get(id);
    if (!current) continue;
    byId.set(id, {
      ...current,
      label: typeof e.data.label === "string" ? cleanPlaceholder(e.data.label) : current.label,
      purpose: typeof e.data.purpose === "string" ? cleanPlaceholder(e.data.purpose) : current.purpose,
      setup: typeof e.data.setup === "string" ? cleanPlaceholder(e.data.setup) : current.setup,
      location: typeof e.data.location === "string" ? cleanPlaceholder(e.data.location) : current.location,
      notes: typeof e.data.notes === "string" ? cleanPlaceholder(e.data.notes) : current.notes,
      priority: asPriority(e.data.priority, current.priority),
      status: asStatus(e.data.status, current.status),
    });
  }

  return Array.from(byId.values()).filter((shot) => !deleted.has(shot.key) && shot.label.trim());
}

function cleanPlaceholder(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "…" || text === "..." ? "" : text;
}

function asPriority(value: unknown, fallback: ShotPriority = "must"): ShotPriority {
  return value === "should" || value === "nice" || value === "must" ? value : fallback;
}

function asStatus(value: unknown, fallback: ShotStatus = "planned"): ShotStatus {
  return value === "captured" || value === "selected" || value === "planned" ? value : fallback;
}
