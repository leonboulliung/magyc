"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { getSelfId } from "@/lib/state";
import type { CrewWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";
import { InlineText } from "./InlineText";

/**
 * Crew — roles the team needs. Each role can be claimed by collaborators.
 *
 * Claims live in module_state as `claim` actions carrying { slotLabel }.
 * Multiple actors may claim the same role; the renderer stacks them.
 * The segment-share link ?role=<slug> highlights one role and lets a
 * new arrival claim it in one click.
 */
export function CrewRenderer({
  module: m,
  index,
  state,
}: {
  module: CrewWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();

  // Bucket claims per role.
  // Track latest per (actor, role) so an actor unclaiming is reflected.
  const latestPerActorRole = new Map<string, ModuleStateEntry>();
  for (const e of state) {
    if (e.kind !== "claim") continue;
    const slot = typeof e.data.slotLabel === "string" ? (e.data.slotLabel as string) : "";
    if (!slot) continue;
    latestPerActorRole.set(`${e.actor.id}::${slot}`, e);
  }
  const buckets = new Map<string, ModuleStateEntry[]>();
  for (const [, e] of latestPerActorRole) {
    if (e.data.claimed === false) continue;
    const slot = (e.data.slotLabel as string) || "";
    const arr = buckets.get(slot) || [];
    arr.push(e);
    buckets.set(slot, arr);
  }

  const myId = getSelfId();

  function iClaimed(slot: string): boolean {
    return (buckets.get(slot) || []).some((e) => e.actor.id === myId);
  }

  async function toggleClaim(slot: string) {
    const next = !iClaimed(slot);
    await ctx.act(index, "claim", { slotLabel: slot, claimed: next });
  }

  async function shareRole(slot: string) {
    const url = `${window.location.origin}${window.location.pathname}?role=${encodeURIComponent(slot)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // no-op
    }
  }

  // Owner config edits (role names + add/remove) via saveModule.
  function save(next: CrewWidget) { ctx.saveModule(index, next); }
  function setRole(i: number, name: string) {
    const roles = m.roles.map((r, j) => (j === i ? { ...r, name } : r));
    save({ ...m, roles });
  }
  function addRole() { save({ ...m, roles: [...m.roles, { name: "Neue Rolle" }] }); }
  function removeRole(i: number) {
    if (m.roles.length <= 1) return;
    save({ ...m, roles: m.roles.filter((_, j) => j !== i) });
  }

  // Hover state for per-row affordance reveal.
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "crew" ? (
          <div className="mono text-[10px] tracking-widest opacity-70 truncate">
            {s.roles.map((r) => r.name).join(" · ")}
          </div>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <p className="mono text-[9px] tracking-widest opacity-40 mb-2" style={{ color: "var(--v-muted)" }}>
          ○ → ●
        </p>
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {m.roles.map((role, i) => {
              const claimers = buckets.get(role.name) || [];
              const mine = iClaimed(role.name);
              return (
                <motion.li
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 3 }}
                  transition={{ duration: 0.15 }}
                  onMouseEnter={() => setHoverRow(role.name)}
                  onMouseLeave={() => setHoverRow(null)}
                  className="flex items-center gap-3 py-1.5 px-1"
                  style={{ borderBottom: "1px solid var(--v-rule)" }}
                >
                  <button
                    type="button"
                    onClick={() => toggleClaim(role.name)}
                    aria-label={mine ? "release" : "claim"}
                    className="inline-flex items-center justify-center shrink-0 transition-all"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "9999px",
                      border: `1.5px solid ${mine ? "var(--v-fg)" : "var(--v-rule)"}`,
                      background: mine ? "var(--v-fg)" : "transparent",
                    }}
                  >
                    {mine && (
                      <span className="mono text-[8px]" style={{ color: "var(--v-bg)" }}>●</span>
                    )}
                  </button>
                  <InlineText
                    value={role.name}
                    isOwner={ctx.isOwner}
                    onSave={(v) => setRole(i, v)}
                    placeholder="Rolle …"
                    className="flex-1 text-[13px]"
                  />

                  {claimers.length > 0 && (
                    <div className="flex -space-x-1.5">
                      {claimers.slice(0, 4).map((e) => (
                        <span
                          key={e.id}
                          style={{ border: "1.5px solid var(--v-bg)", borderRadius: "9999px" }}
                        >
                          <ActorDot
                            color={typeof e.data.color === "string" ? (e.data.color as string) : undefined}
                            displayName={e.actor.displayName}
                            size={18}
                          />
                        </span>
                      ))}
                      {claimers.length > 4 && (
                        <span
                          className="mono text-[9px] tabular-nums ml-2 self-center"
                          style={{ color: "var(--v-muted)" }}
                        >
                          +{claimers.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <AnimatePresence>
                    {hoverRow === role.name && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="flex items-center gap-1"
                      >
                        <button
                          type="button"
                          onClick={() => shareRole(role.name)}
                          aria-label="share role"
                          title="copy share link"
                          className="mono text-[11px] px-1.5 opacity-60 hover:opacity-100"
                          style={{ color: "var(--v-fg)" }}
                        >
                          ⎘
                        </button>
                        {ctx.isOwner && m.roles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRole(i)}
                            aria-label="Rolle entfernen"
                            className="mono text-[13px] px-1 opacity-50 hover:opacity-100"
                            style={{ color: "var(--v-muted)" }}
                          >
                            ×
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        {ctx.isOwner && (
          <button
            type="button"
            onClick={addRole}
            className="mono mt-2 rounded-full px-2.5 py-1 text-[10px] tracking-widest opacity-60 hover:opacity-100"
            style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
          >
            + Rolle
          </button>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}
