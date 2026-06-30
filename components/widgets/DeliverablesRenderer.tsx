"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { newLocalId } from "@/lib/id";
import { displayActorName, getSelfId } from "@/lib/state";
import { useWidgetContext } from "@/lib/widgetContext";
import type {
  DeliverableStatus,
  DeliverablesWidget,
  ModuleStateEntry,
} from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { ActorDot, WidgetCard } from "./WidgetCard";
import { useInlineEdit } from "./useInlineEdit";
import { workflowLabels } from "./workflowLabels";

const STATUSES: readonly DeliverableStatus[] = [
  "planned",
  "in_progress",
  "ready",
  "delivered",
] as const;

function nextStatus(status: DeliverableStatus): DeliverableStatus {
  const idx = STATUSES.indexOf(status);
  return STATUSES[(idx + 1) % STATUSES.length] ?? "planned";
}

function statusTone(status: DeliverableStatus) {
  switch (status) {
    case "in_progress":
      return { border: "rgba(59,130,246,0.28)", background: "rgba(59,130,246,0.10)" };
    case "ready":
      return { border: "rgba(34,197,94,0.28)", background: "rgba(34,197,94,0.10)" };
    case "delivered":
      return { border: "rgba(34,39,46,0.22)", background: "rgba(34,39,46,0.10)" };
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
  const lex = workflowLabels(ctx.language);
  const items = buildDeliverables(m, state);
  const owners = buildOwners(state);
  const myId = getSelfId();

  async function updateItem(
    itemKey: string,
    patch: Partial<Pick<DeliverableView, "label" | "details" | "quantity" | "format" | "status">>,
  ) {
    await ctx.act(index, "edit", { id: itemKey, ...patch });
  }

  async function toggleOwner(itemKey: string) {
    const owner = owners.get(itemKey);
    if (owner && owner.actorId !== myId) return;
    const claiming = !owner || owner.actorId !== myId;
    await ctx.act(index, "claim", { slotLabel: itemKey, claimed: claiming });
  }

  const [pending, setPending] = useState("");
  const [adding, setAdding] = useState(false);

  async function addItem() {
    const value = pending.trim();
    setPending("");
    setAdding(false);
    if (!value) return;
    await ctx.act(index, "add", {
      id: newLocalId("dlv"),
      label: value,
      status: "planned",
    });
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "deliverables" ? (
          <ul className="text-[11px] leading-snug opacity-80 list-disc pl-4">
            {s.items.slice(0, 4).map((item, i) => (
              <li key={i} className="truncate">{item.label}</li>
            ))}
          </ul>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {items.length === 0 ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-[var(--v-radius)] px-3 py-4 text-left"
            style={{ border: "1px dashed var(--v-rule)", color: "var(--v-muted)" }}
          >
            <div className="mono text-[11px] tracking-widest">Noch keine Deliverables angelegt.</div>
            <div className="mono mt-2 text-[10px] tracking-widest" style={{ color: "var(--v-fg)" }}>
              + Eintrag hinzufügen
            </div>
          </button>
        ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const tone = statusTone(item.status);
              const owner = owners.get(item.key);
              const mine = owner?.actorId === myId;
              return (
                <motion.div
                  key={item.key}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-[var(--v-radius)] p-3"
                  style={{
                    border: "1px solid var(--v-rule)",
                    background: "var(--v-card)",
                    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => updateItem(item.key, { status: nextStatus(item.status) })}
                      className="shrink-0 rounded-full px-2.5 py-1 mono text-[9px] tracking-widest uppercase"
                      style={{
                        border: `1px solid ${tone.border}`,
                        background: tone.background,
                        color: "var(--v-fg)",
                      }}
                    >
                      {labelForStatus(item.status, lex)}
                    </button>

                    <div className="flex-1 min-w-0">
                      <InlineWorkflowText
                        value={item.label}
                        placeholder="Ergebnis benennen"
                        onSave={(next) => updateItem(item.key, { label: next })}
                        className="text-[13px] leading-snug"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <InlineWorkflowText
                          value={item.quantity ?? ""}
                          placeholder="Menge"
                          onSave={(next) => updateItem(item.key, { quantity: next })}
                          allowEmpty
                          className="mono text-[9px] tracking-widest uppercase"
                          buttonStyle={{
                            border: "1px dashed var(--v-rule)",
                            borderRadius: 999,
                            padding: "4px 10px",
                            color: item.quantity ? "var(--v-fg)" : "var(--v-muted)",
                          }}
                          inputStyle={{
                            border: "1px dashed var(--v-rule)",
                            borderRadius: 999,
                            padding: "4px 10px",
                          }}
                        />

                        <InlineWorkflowText
                          value={item.format ?? ""}
                          placeholder="Format"
                          onSave={(next) => updateItem(item.key, { format: next })}
                          allowEmpty
                          className="mono text-[9px] tracking-widest uppercase"
                          buttonStyle={{
                            border: "1px dashed var(--v-rule)",
                            borderRadius: 999,
                            padding: "4px 10px",
                            color: item.format ? "var(--v-fg)" : "var(--v-muted)",
                          }}
                          inputStyle={{
                            border: "1px dashed var(--v-rule)",
                            borderRadius: 999,
                            padding: "4px 10px",
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => toggleOwner(item.key)}
                          disabled={!!owner && !mine}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                          style={{
                            border: "1px dashed var(--v-rule)",
                            color: "var(--v-fg)",
                            opacity: owner && !mine ? 0.8 : 1,
                          }}
                        >
                          {owner ? (
                            <>
                              <ActorDot color={owner.color} displayName={displayActorName({ id: owner.actorId, kind: "user", displayName: owner.name })} size={16} />
                              <span className="mono text-[9px] tracking-widest uppercase">
                                {mine ? lex.release : displayActorName({ id: owner.actorId, kind: "user", displayName: owner.name })}
                              </span>
                            </>
                          ) : (
                            <span className="mono text-[9px] tracking-widest uppercase">
                              {lex.assign}
                            </span>
                          )}
                        </button>
                      </div>

                      <div className="mt-2">
                        <InlineWorkflowText
                          value={item.details ?? ""}
                          placeholder="Kanal, Motivgruppe oder Übergabehinweis"
                          onSave={(next) => updateItem(item.key, { details: next })}
                          allowEmpty
                          className="text-[12px] leading-snug"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        )}

        <div className={`mt-3 ${items.length === 0 && !adding ? "hidden" : ""}`}>
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
              placeholder="Ergebnis hinzufügen ..."
              className="w-full text-[13px] bg-transparent outline-none px-2 py-1 rounded-[var(--v-radius)]"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="Ergebnis hinzufügen"
              className="mono text-[10px] tracking-widest px-3 py-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              + Eintrag hinzufügen
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

function buildDeliverables(module: DeliverablesWidget, state: ModuleStateEntry[]): DeliverableView[] {
  const byId = new Map<string, DeliverableView>();

  module.items.forEach((item, i) => {
    byId.set(`seed-${i}`, {
      key: `seed-${i}`,
      label: item.label,
        details: item.details,
        quantity: item.quantity,
        format: item.format,
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
        status: isDeliverableStatus(e.data.status) ? e.data.status : "planned",
      });
    });

  state
    .filter((e) => e.kind === "edit")
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((e) => {
      const id = typeof e.data.id === "string" ? e.data.id : null;
      if (!id) return;
      const item = byId.get(id);
      if (!item) return;
      if (typeof e.data.label === "string" && e.data.label.trim()) item.label = e.data.label;
      if (typeof e.data.details === "string") item.details = e.data.details.trim() ? e.data.details : undefined;
      if (typeof e.data.quantity === "string") item.quantity = e.data.quantity.trim() ? e.data.quantity : undefined;
      if (typeof e.data.format === "string") item.format = e.data.format.trim() ? e.data.format : undefined;
      if (isDeliverableStatus(e.data.status)) item.status = e.data.status;
    });

  return [...byId.values()];
}

function buildOwners(state: ModuleStateEntry[]) {
  const latestPerActorItem = new Map<string, ModuleStateEntry>();
  for (const e of state) {
    if (e.kind !== "claim") continue;
    const slot = typeof e.data.slotLabel === "string" ? e.data.slotLabel : "";
    if (!slot) continue;
    latestPerActorItem.set(`${e.actor.id}::${slot}`, e);
  }

  const owners = new Map<string, { actorId: string; color?: string; name?: string }>();
  for (const [, e] of latestPerActorItem) {
    if (e.data.claimed === false) continue;
    const slot = typeof e.data.slotLabel === "string" ? e.data.slotLabel : "";
    if (!slot || owners.has(slot)) continue;
    owners.set(slot, {
      actorId: e.actor.id,
      color: typeof e.data.color === "string" ? e.data.color : undefined,
      name: e.actor.displayName,
    });
  }
  return owners;
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

function InlineWorkflowText({
  value,
  placeholder,
  onSave,
  className,
  allowEmpty = false,
  buttonStyle,
  inputStyle,
}: {
  value: string;
  placeholder: string;
  onSave: (next: string) => Promise<void> | void;
  className?: string;
  allowEmpty?: boolean;
  buttonStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}) {
  const { editing, setEditing, editProps } = useInlineEdit<HTMLInputElement>({
    value,
    onSave: (next) => {
      if (!allowEmpty && !next.trim()) return;
      return onSave(next);
    },
    submitOn: "enter",
    focusMode: "all",
  });

  if (editing) {
    return (
      <input
        {...editProps}
        maxLength={200}
        className={`w-full bg-transparent outline-none ${className ?? ""}`}
        style={{ color: "var(--v-fg)", ...inputStyle }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`text-left ${className ?? ""}`}
      style={buttonStyle ?? { color: value ? "var(--v-fg)" : "var(--v-muted)" }}
    >
      {value || placeholder}
    </button>
  );
}
