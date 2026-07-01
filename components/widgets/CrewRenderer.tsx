"use client";

import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { displayActorName, getSelfId } from "@/lib/state";
import type { CrewWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";
import { InlineText } from "./InlineText";

/**
 * Crew — assignable roles / people involved in the shoot.
 *
 * The photographer should be able to understand one row at a glance:
 * role name, who already claimed it, and one clear action to take it.
 * No shifting hover chrome, no cryptic initials on their own.
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
  const presetMode = ctx.mode === "preset";
  const myId = getSelfId();

  const claimsByRole = new Map<string, ModuleStateEntry[]>();
  const latestPerActorRole = new Map<string, ModuleStateEntry>();
  for (const entry of state) {
    if (entry.kind !== "claim") continue;
    const slot = typeof entry.data.slotLabel === "string" ? entry.data.slotLabel : "";
    if (!slot) continue;
    latestPerActorRole.set(`${entry.actor.id}::${slot}`, entry);
  }
  for (const [, entry] of latestPerActorRole) {
    if (entry.data.claimed === false) continue;
    const slot = typeof entry.data.slotLabel === "string" ? entry.data.slotLabel : "";
    if (!slot) continue;
    const bucket = claimsByRole.get(slot) || [];
    bucket.push(entry);
    claimsByRole.set(slot, bucket);
  }

  function save(next: CrewWidget) {
    return ctx.saveModule(index, next, { errorMessage: "Die Rollen konnten nicht gespeichert werden." });
  }

  function setRole(roleIndex: number, name: string) {
    const roles = m.roles.map((role, currentIndex) => (
      currentIndex === roleIndex ? { ...role, name } : role
    ));
    void save({ ...m, roles });
  }

  function addRole() {
    void save({ ...m, roles: [...m.roles, { name: "" }] });
  }

  function removeRole(roleIndex: number) {
    const roles = m.roles.filter((_, currentIndex) => currentIndex !== roleIndex);
    void save({ ...m, roles });
  }

  async function toggleClaim(slotLabel: string) {
    if (presetMode) return;
    const mine = (claimsByRole.get(slotLabel) || []).some((entry) => entry.actor.id === myId);
    await ctx.act(index, "claim", { slotLabel, claimed: !mine });
  }

  async function copyRoleLink(slotLabel: string) {
    const url = `${window.location.origin}${window.location.pathname}?role=${encodeURIComponent(slotLabel)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Best-effort only.
    }
  }

  return (
    <WidgetShell
      module={m}
      index={index}
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {m.roles.length === 0 ? (
          <button
            type="button"
            onClick={ctx.isOwner ? addRole : undefined}
            disabled={!ctx.isOwner}
            className="w-full rounded-[var(--v-radius)] px-3 py-4 text-left transition-colors"
            style={{
              border: "1px dashed var(--v-rule)",
              color: "var(--v-muted)",
              cursor: ctx.isOwner ? "pointer" : "default",
            }}
          >
            <div className="mono text-[10px] tracking-widest" style={{ color: "var(--v-fg)" }}>{ctx.isOwner ? "+ Erstes Mitglied hinzufügen" : "Noch keine Mitglieder"}</div>
          </button>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {m.roles.map((role, roleIndex) => {
                const slotLabel = role.name || `role-${roleIndex}`;
                const claimers = claimsByRole.get(slotLabel) || [];
                const mine = claimers.some((entry) => entry.actor.id === myId);
                return (
                  <motion.li
                    key={roleIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="rounded-[var(--v-radius)] p-3"
                    style={{
                      border: "1px solid var(--v-rule)",
                      background: "var(--v-card)",
                      boxShadow: "inset 0 1px 1px rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {!presetMode && (
                        <button
                          type="button"
                          onClick={() => toggleClaim(slotLabel)}
                          aria-label={mine ? "Zuteilung aufheben" : "Mir zuweisen"}
                          className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-all"
                          style={{
                            border: `1.5px solid ${mine ? "var(--v-fg)" : "var(--v-rule)"}`,
                            background: mine ? "var(--v-fg)" : "transparent",
                          }}
                        >
                          {mine && <span className="mono text-[9px]" style={{ color: "var(--v-bg)" }}>✓</span>}
                        </button>
                      )}

                      <div className="min-w-0 flex-1">
                        <InlineText
                          value={role.name}
                          isOwner={ctx.isOwner}
                          onSave={(next) => setRole(roleIndex, next)}
                          placeholder="Rolle oder Person benennen"
                          className="block text-[13px] leading-snug"
                        />

                        {!presetMode && <div className="mt-2 flex flex-wrap gap-2">
                          {claimers.length > 0 ? (
                            claimers.map((entry) => {
                              const name = displayActorName(entry.actor);
                              return (
                                <div
                                  key={entry.id}
                                  className="inline-flex items-center gap-2 rounded-full px-2.5 py-1"
                                  style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
                                >
                                  <ActorDot
                                    color={typeof entry.data.color === "string" ? entry.data.color : undefined}
                                    displayName={name}
                                    size={18}
                                  />
                                  <span className="mono text-[10px] tracking-widest">{name}</span>
                                </div>
                              );
                            })
                          ) : (
                            <span className="mono text-[10px] tracking-widest opacity-55" style={{ color: "var(--v-muted)" }}>
                              Noch niemand zugeteilt.
                            </span>
                          )}
                        </div>}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {!!role.name && !presetMode && (
                          <button
                            type="button"
                            onClick={() => copyRoleLink(role.name)}
                            aria-label="Rollenlink kopieren"
                            title="Rollenlink kopieren"
                            className="mono rounded-full px-2 py-1 text-[10px] tracking-widest transition-opacity hover:opacity-100"
                            style={{ border: "1px solid var(--v-rule)", color: "var(--v-muted)", opacity: 0.72 }}
                          >
                            ⎘
                          </button>
                        )}
                        {ctx.isOwner && (
                          <button
                            type="button"
                            onClick={() => removeRole(roleIndex)}
                            aria-label="Rolle entfernen"
                            className="mono rounded-full px-2 py-1 text-[12px] transition-opacity hover:opacity-100"
                            style={{ border: "1px solid var(--v-rule)", color: "var(--v-muted)", opacity: 0.72 }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {ctx.isOwner && m.roles.length > 0 && (
          <button
            type="button"
            onClick={addRole}
            className="mono mt-3 rounded-full px-3 py-1 text-[10px] tracking-widest transition-opacity hover:opacity-100"
            style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)", opacity: 0.72 }}
          >
            + Mitglied hinzufügen
          </button>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}
