"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { newLocalId } from "@/lib/id";
import { displayActorName, getSelfId } from "@/lib/state";
import { useWidgetContext } from "@/lib/widgetContext";
import { useT } from "@/components/i18n/LocaleProvider";
import type {
  ApprovalAudience,
  ApprovalStatus,
  ApprovalsWidget,
  ModuleStateEntry,
} from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";
import { useInlineEdit } from "./useInlineEdit";
import { workflowLabels } from "./workflowLabels";

const PRE_APPROVAL_STATUSES: readonly ApprovalStatus[] = ["pending", "requested"] as const;

function nextApprovalStatus(status: ApprovalStatus): ApprovalStatus {
  if (status === "approved") return status;
  const idx = PRE_APPROVAL_STATUSES.indexOf(status);
  return PRE_APPROVAL_STATUSES[(idx + 1) % PRE_APPROVAL_STATUSES.length] ?? "pending";
}

function approvalTone(status: ApprovalStatus) {
  switch (status) {
    case "requested":
      return { border: "rgba(245,158,11,0.28)", background: "rgba(245,158,11,0.10)" };
    case "approved":
      return { border: "rgba(34,197,94,0.28)", background: "rgba(34,197,94,0.10)" };
    default:
      return { border: "var(--v-rule)", background: "transparent" };
  }
}

interface ApprovalView {
  key: string;
  text: string;
  description?: string;
  audience?: ApprovalAudience;
  status: ApprovalStatus;
}

export function ApprovalsRenderer({
  module: m,
  index,
  state,
}: {
  module: ApprovalsWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const tr = useT();
  const lex = workflowLabels(ctx.language);
  const items = buildApprovals(m, state);
  const owners = buildOwners(state);
  const approvals = buildApprovers(state);
  const myId = getSelfId();

  async function updateItem(
    itemKey: string,
    patch: Partial<Pick<ApprovalView, "text" | "status">>,
  ) {
    await ctx.act(index, "edit", { id: itemKey, ...patch });
  }

  async function toggleOwner(itemKey: string) {
    const owner = owners.get(itemKey);
    if (owner && owner.actorId !== myId) return;
    const claiming = !owner || owner.actorId !== myId;
    await ctx.act(index, "claim", { slotLabel: itemKey, claimed: claiming });
  }

  async function toggleApproval(itemKey: string) {
    const mine = (approvals.get(itemKey) || []).some((checker) => checker.actorId === myId);
    await ctx.act(index, "check", { itemKey, checked: !mine });
  }

  const [pending, setPending] = useState("");
  const [adding, setAdding] = useState(false);

  async function addItem() {
    const value = pending.trim();
    setPending("");
    setAdding(false);
    if (!value) return;
    await ctx.act(index, "add", {
      id: newLocalId("apr"),
      text: value,
      status: "pending",
      audience: "client",
    });
  }

  async function remove(key: string) {
    // Tombstone seed + collaborator entries alike: splicing seed items out of
    // config shifts later seed-N indices and mis-maps existing state.
    await ctx.act(index, "edit", { id: key, deleted: true });
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "approvals" ? (
          <ul className="text-[11px] leading-snug opacity-80 list-disc pl-4">
            {s.items.slice(0, 4).map((item, i) => (
              <li key={i} className="truncate">{item.text}</li>
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
            <div className="mono text-[10px] tracking-widest" style={{ color: "var(--v-fg)" }}>{tr.elements.addFirstApproval}</div>
          </button>
        ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const checkers = approvals.get(item.key) || [];
              const owner = owners.get(item.key);
              const mine = owner?.actorId === myId;
              const myApproval = checkers.some((checker) => checker.actorId === myId);
              const effectiveStatus: ApprovalStatus =
                checkers.length > 0 ? "approved" : item.status;
              const tone = approvalTone(effectiveStatus);

              return (
                <motion.div
                  key={item.key}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="group relative rounded-[var(--v-radius)] p-3"
                  style={{
                    border: "1px solid var(--v-rule)",
                    background: "var(--v-card)",
                    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.08)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => remove(item.key)}
                    aria-label={tr.elements.removeApproval}
                    className="reveal-on-hover mono absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-[12px] leading-none"
                    style={{ color: "var(--v-muted)" }}
                  >
                    ×
                  </button>
                  <div className="flex items-start gap-3 pr-7">
                    <button
                      type="button"
                      onClick={() => toggleApproval(item.key)}
                      aria-label={myApproval ? "unapprove" : "approve"}
                      className="shrink-0 mt-0.5 inline-flex items-center justify-center transition-all"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "9999px",
                        border: `1.5px solid ${effectiveStatus === "approved" ? "var(--v-fg)" : "var(--v-rule)"}`,
                        background: effectiveStatus === "approved" ? "var(--v-fg)" : "transparent",
                      }}
                    >
                      {effectiveStatus === "approved" && (
                        <span className="mono text-[9px]" style={{ color: "var(--v-bg)" }}>
                          ✓
                        </span>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (effectiveStatus === "approved") return;
                            void updateItem(item.key, { status: nextApprovalStatus(item.status) });
                          }}
                          className="rounded-full px-2.5 py-1 mono text-[9px] tracking-widest uppercase"
                          style={{
                            border: `1px solid ${tone.border}`,
                            background: tone.background,
                            color: "var(--v-fg)",
                          }}
                        >
                          {labelForApprovalStatus(effectiveStatus, lex)}
                        </button>

                        {item.audience && (
                          <span
                            className="rounded-full px-2.5 py-1 mono text-[9px] tracking-widest uppercase"
                            style={{ border: "1px dashed var(--v-rule)", color: "var(--v-muted)" }}
                          >
                            {item.audience === "client" ? lex.client : lex.internal}
                          </span>
                        )}
                      </div>

                      <div className="mt-2">
                        <InlineWorkflowText
                          value={item.text}
                          placeholder={tr.elements.nameApproval}
                          onSave={(next) => updateItem(item.key, { text: next })}
                          className="text-[13px] leading-snug"
                        />
                      </div>

                      {item.description && (
                        <div className="text-[12px] leading-snug mt-1" style={{ color: "var(--v-muted)" }}>
                          {item.description}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2">
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

                      {checkers.length > 0 && (
                        <div className="flex -space-x-1.5 mt-2">
                          {checkers.slice(0, 6).map((checker) => (
                            <span
                              key={`${item.key}-${checker.actorId}`}
                              style={{ border: "1.5px solid var(--v-bg)", borderRadius: "9999px" }}
                            >
                              <ActorDot
                                color={checker.color}
                                displayName={displayActorName({ id: checker.actorId, kind: "user", displayName: checker.name })}
                                size={18}
                              />
                            </span>
                          ))}
                          {checkers.length > 6 && (
                            <span className="mono text-[9px] tabular-nums ml-2 self-center" style={{ color: "var(--v-muted)" }}>
                              +{checkers.length - 6}
                            </span>
                          )}
                        </div>
                      )}
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
              placeholder={tr.elements.addApprovalPlaceholder}
              className="w-full text-[13px] bg-transparent outline-none px-2 py-1 rounded-[var(--v-radius)]"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label={tr.elements.addApproval}
              className="mono text-[10px] tracking-widest px-3 py-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
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

function buildApprovals(module: ApprovalsWidget, state: ModuleStateEntry[]): ApprovalView[] {
  const byId = new Map<string, ApprovalView>();
  const deleted = new Set<string>();

  module.items.forEach((item, i) => {
    byId.set(`seed-${i}`, {
      key: `seed-${i}`,
      text: item.text,
      description: item.description,
      audience: item.audience,
      status: item.status ?? "pending",
    });
  });

  state
    .filter((e) => e.kind === "add")
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((e) => {
      const id = typeof e.data.id === "string" ? e.data.id : e.id;
      const text = typeof e.data.text === "string" ? e.data.text : "";
      if (!text.trim()) return;
      byId.set(id, {
        key: id,
        text,
        description: typeof e.data.description === "string" ? e.data.description : undefined,
        audience: isApprovalAudience(e.data.audience) ? e.data.audience : undefined,
        status: isApprovalStatus(e.data.status) ? e.data.status : "pending",
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
      if (typeof e.data.text === "string" && e.data.text.trim()) item.text = e.data.text;
      if (isApprovalStatus(e.data.status)) item.status = e.data.status;
    });

  return [...byId.values()].filter((item) => !deleted.has(item.key));
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

function buildApprovers(state: ModuleStateEntry[]) {
  const latestPerActorItem = new Map<string, ModuleStateEntry>();
  for (const e of state) {
    if (e.kind !== "check") continue;
    const itemKey = typeof e.data.itemKey === "string" ? e.data.itemKey : "";
    if (!itemKey) continue;
    latestPerActorItem.set(`${e.actor.id}::${itemKey}`, e);
  }

  const approvals = new Map<string, { actorId: string; color?: string; name?: string }[]>();
  for (const [k, e] of latestPerActorItem.entries()) {
    if (!e.data.checked) continue;
    const itemKey = k.split("::")[1];
    const arr = approvals.get(itemKey) || [];
    arr.push({
      actorId: e.actor.id,
      color: typeof e.data.color === "string" ? e.data.color : undefined,
      name: e.actor.displayName,
    });
    approvals.set(itemKey, arr);
  }
  return approvals;
}

function isApprovalAudience(value: unknown): value is ApprovalAudience {
  return value === "client" || value === "internal";
}

function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return value === "pending" || value === "requested" || value === "approved";
}

function labelForApprovalStatus(status: ApprovalStatus, lex: ReturnType<typeof workflowLabels>) {
  switch (status) {
    case "requested":
      return lex.requested;
    case "approved":
      return lex.approved;
    default:
      return lex.pending;
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
