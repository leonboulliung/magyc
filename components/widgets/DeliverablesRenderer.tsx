"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { newLocalId } from "@/lib/id";
import { useWidgetContext } from "@/lib/widgetContext";
import { useT } from "@/components/i18n/LocaleProvider";
import type {
  DeliverableStatus,
  DeliverablesWidget,
  ModuleStateEntry,
} from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { workflowLabels } from "./workflowLabels";

/**
 * Deliverables — the concrete outputs the client receives.
 *
 * Rebuilt for clarity: one titled entry per deliverable, a single tap-to-cycle
 * status, and a small set of clearly LABELLED optional fields (quantity,
 * format, due date, note) so their meaning is obvious and they invite filling
 * in — instead of a row of unlabelled pills. Every entry can be deleted.
 * Seed items live in widget config; collaborator entries live in module_state.
 */

const STATUSES: readonly DeliverableStatus[] = ["planned", "in_progress", "ready", "delivered"] as const;

function nextStatus(status: DeliverableStatus): DeliverableStatus {
  const idx = STATUSES.indexOf(status);
  return STATUSES[(idx + 1) % STATUSES.length] ?? "planned";
}

function statusTone(status: DeliverableStatus) {
  switch (status) {
    case "in_progress":
      return { border: "rgba(59,130,246,0.32)", background: "rgba(59,130,246,0.12)" };
    case "ready":
      return { border: "rgba(34,197,94,0.32)", background: "rgba(34,197,94,0.12)" };
    case "delivered":
      return { border: "rgba(34,197,94,0.5)", background: "rgba(34,197,94,0.2)" };
    default:
      return { border: "var(--v-rule)", background: "transparent" };
  }
}

interface DeliverableView {
  key: string;
  label: string;
  details?: string;
  quantity?: string;
  format?: string;
  due?: string;
  status: DeliverableStatus;
}

export function DeliverablesRenderer({
  module: m,
  index,
  state,
}: {
  module: DeliverablesWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const tr = useT();
  const lex = workflowLabels(ctx.language);
  const items = buildDeliverables(m, state);

  const [pending, setPending] = useState("");
  const [adding, setAdding] = useState(false);

  async function addItem() {
    const value = pending.trim();
    setPending("");
    setAdding(false);
    if (!value) return;
    await ctx.act(index, "add", { id: newLocalId("dlv"), label: value, status: "planned" });
  }

  function update(key: string, patch: Partial<Omit<DeliverableView, "key">>) {
    return ctx.act(index, "edit", { id: key, ...patch });
  }

  async function remove(key: string) {
    // Tombstone for BOTH seed and collaborator entries. Splicing seed items out
    // of config would shift every later seed-N index, so existing edits/checks
    // keyed to those positions would silently attach to the wrong entry.
    await ctx.act(index, "edit", { id: key, deleted: true });
  }

  const addBtn = (
    <button
      type="button"
      onClick={() => setAdding(true)}
      aria-label={tr.elements.addDeliverable}
      className="mono rounded-full px-3 py-1 text-[10px] tracking-widest opacity-70 transition-opacity hover:opacity-100"
      style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
    >
      {items.length === 0 ? tr.elements.addFirstDeliverable : tr.elements.addEntry}
    </button>
  );

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "deliverables" ? (
          <ul className="list-disc pl-4 text-[11px] leading-snug opacity-80">
            {s.items.slice(0, 4).map((item, i) => (
              <li key={i} className="truncate">{item.label}</li>
            ))}
          </ul>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const tone = statusTone(item.status);
              return (
                <motion.div
                  key={item.key}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="group relative rounded-[var(--v-radius)] p-3"
                  style={{ border: "1px solid var(--v-rule)", background: "var(--v-card)" }}
                >
                  <button
                    type="button"
                    onClick={() => remove(item.key)}
                    aria-label={tr.elements.removeDeliverable}
                    className="reveal-on-hover mono absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-[12px] leading-none"
                    style={{ color: "var(--v-muted)" }}
                  >
                    ×
                  </button>

                  <div className="flex items-start gap-3 pr-7">
                    <button
                      type="button"
                      onClick={() => update(item.key, { status: nextStatus(item.status) })}
                      title={tr.elements.changeStatus}
                      className="mono shrink-0 rounded-full px-2.5 py-1 text-[9px] uppercase tracking-widest"
                      style={{ border: `1px solid ${tone.border}`, background: tone.background, color: "var(--v-fg)" }}
                    >
                      {labelForStatus(item.status, lex)}
                    </button>

                    <div className="min-w-0 flex-1 space-y-2.5">
                      <Field
                        value={item.label}
                        placeholder={tr.elements.deliverableWhat}
                        onSave={(v) => v.trim() && update(item.key, { label: v })}
                        bold
                      />
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Field label="Menge" value={item.quantity ?? ""} placeholder="z. B. 15–20" onSave={(v) => update(item.key, { quantity: v })} />
                        <Field label="Format" value={item.format ?? ""} placeholder="z. B. JPG · 4000px" onSave={(v) => update(item.key, { format: v })} />
                        <Field label="Frist" value={item.due ?? ""} type="date" onSave={(v) => update(item.key, { due: v })} />
                      </div>
                      <Field
                        label={tr.elements.noteLabel}
                        value={item.details ?? ""}
                        placeholder={tr.elements.deliverableHint}
                        onSave={(v) => update(item.key, { details: v })}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="mt-3">
          {adding ? (
            <input
              autoFocus
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              onBlur={addItem}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addItem(); }
                else if (e.key === "Escape") { setPending(""); setAdding(false); }
              }}
              maxLength={200}
              placeholder={tr.elements.nameDeliverable}
              className="w-full rounded-[var(--v-radius)] bg-transparent px-2 py-1 text-[13px] outline-none"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            addBtn
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

/**
 * A labelled, always-visible field. The small caption makes each slot's
 * meaning explicit; edits commit on blur / Enter. Local draft resyncs when the
 * underlying value changes (e.g. a realtime edit) while not being typed into.
 */
function Field({
  value,
  onSave,
  label,
  placeholder,
  type = "text",
  bold = false,
}: {
  value: string;
  onSave: (next: string) => void;
  label?: string;
  placeholder?: string;
  type?: "text" | "date";
  bold?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => { if (draft.trim() !== value.trim()) onSave(draft.trim()); };

  return (
    <label className="block">
      {label && (
        <span className="mono mb-1 block text-[8px] uppercase tracking-[0.18em]" style={{ color: "var(--v-muted)" }}>
          {label}
        </span>
      )}
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
        placeholder={placeholder}
        maxLength={200}
        className={`w-full rounded-[10px] bg-transparent px-2 py-1.5 outline-none ${bold ? "text-[14px] font-medium" : "text-[12px]"}`}
        style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
      />
    </label>
  );
}

function buildDeliverables(module: DeliverablesWidget, state: ModuleStateEntry[]): DeliverableView[] {
  const byId = new Map<string, DeliverableView>();
  const deleted = new Set<string>();

  module.items.forEach((item, i) => {
    byId.set(`seed-${i}`, {
      key: `seed-${i}`,
      label: item.label,
      details: item.details,
      quantity: item.quantity,
      format: item.format,
      due: item.due,
      status: item.status ?? "planned",
    });
  });

  state
    .filter((e) => e.kind === "add")
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((e) => {
      const id = typeof e.data.id === "string" ? e.data.id : e.id;
      const label = typeof e.data.label === "string" ? e.data.label : "";
      if (!label.trim()) return;
      byId.set(id, {
        key: id,
        label,
        details: typeof e.data.details === "string" ? e.data.details : undefined,
        quantity: typeof e.data.quantity === "string" ? e.data.quantity : undefined,
        format: typeof e.data.format === "string" ? e.data.format : undefined,
        due: typeof e.data.due === "string" ? e.data.due : undefined,
        status: isDeliverableStatus(e.data.status) ? e.data.status : "planned",
      });
    });

  state
    .filter((e) => e.kind === "edit")
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((e) => {
      const id = typeof e.data.id === "string" ? e.data.id : null;
      if (!id) return;
      if (e.data.deleted === true) { deleted.add(id); return; }
      const item = byId.get(id);
      if (!item) return;
      if (typeof e.data.label === "string" && e.data.label.trim()) item.label = e.data.label;
      if (typeof e.data.details === "string") item.details = e.data.details.trim() ? e.data.details : undefined;
      if (typeof e.data.quantity === "string") item.quantity = e.data.quantity.trim() ? e.data.quantity : undefined;
      if (typeof e.data.format === "string") item.format = e.data.format.trim() ? e.data.format : undefined;
      if (typeof e.data.due === "string") item.due = e.data.due.trim() ? e.data.due : undefined;
      if (isDeliverableStatus(e.data.status)) item.status = e.data.status;
    });

  return [...byId.values()].filter((item) => !deleted.has(item.key));
}

function isDeliverableStatus(value: unknown): value is DeliverableStatus {
  return typeof value === "string" && STATUSES.includes(value as DeliverableStatus);
}

function labelForStatus(status: DeliverableStatus, lex: ReturnType<typeof workflowLabels>) {
  switch (status) {
    case "in_progress":
      return lex.inProgress;
    case "ready":
      return lex.ready;
    case "delivered":
      return lex.delivered;
    default:
      return lex.planned;
  }
}
