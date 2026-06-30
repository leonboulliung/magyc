"use client";

import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import { displayActorName, getSelfId } from "@/lib/state";
import type { ModuleStateEntry, WorkPackagesWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard, ActorDot } from "./WidgetCard";
import { InlineText } from "./InlineText";

/**
 * Aufgaben — configurable work blocks with optional assignees.
 *
 * This is project structure, not chat state. The label should therefore start
 * as a real placeholder and never force the user to erase canned text first.
 */
export function WorkPackagesRenderer({
  module: m,
  index,
  state,
}: {
  module: WorkPackagesWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const myId = getSelfId();

  const claimsByPackage = new Map<string, ModuleStateEntry[]>();
  const latestPerActorPackage = new Map<string, ModuleStateEntry>();
  for (const entry of state) {
    if (entry.kind !== "claim") continue;
    const slot = typeof entry.data.slotLabel === "string" ? entry.data.slotLabel : "";
    if (!slot) continue;
    latestPerActorPackage.set(`${entry.actor.id}::${slot}`, entry);
  }
  for (const [, entry] of latestPerActorPackage) {
    if (entry.data.claimed === false) continue;
    const slot = typeof entry.data.slotLabel === "string" ? entry.data.slotLabel : "";
    if (!slot) continue;
    const bucket = claimsByPackage.get(slot) || [];
    bucket.push(entry);
    claimsByPackage.set(slot, bucket);
  }

  function save(next: WorkPackagesWidget) {
    return ctx.saveModule(index, next, { errorMessage: "Die Aufgaben konnten nicht gespeichert werden." });
  }

  function setPackage(
    packageIndex: number,
    patch: Partial<{ label: string; description: string }>,
  ) {
    const packages = m.packages.map((item, currentIndex) => (
      currentIndex === packageIndex ? { ...item, ...patch } : item
    ));
    void save({ ...m, packages });
  }

  function addPackage() {
    void save({ ...m, packages: [...m.packages, { label: "", description: "" }] });
  }

  function removePackage(packageIndex: number) {
    const packages = m.packages.filter((_, currentIndex) => currentIndex !== packageIndex);
    void save({ ...m, packages });
  }

  async function toggleClaim(slotLabel: string) {
    const mine = (claimsByPackage.get(slotLabel) || []).some((entry) => entry.actor.id === myId);
    await ctx.act(index, "claim", { slotLabel, claimed: !mine });
  }

  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(suggestion) =>
        suggestion.type === "work_packages" ? (
          <ul className="list-disc pl-4 text-[11px] leading-snug opacity-80">
            {suggestion.packages.slice(0, 4).map((item, itemIndex) => (
              <li key={itemIndex} className="truncate">
                {item.label || "Aufgabe"}
              </li>
            ))}
          </ul>
        ) : null
      }
    >
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {m.packages.length === 0 ? (
          <button
            type="button"
            onClick={ctx.isOwner ? addPackage : undefined}
            disabled={!ctx.isOwner}
            className="w-full rounded-[var(--v-radius)] px-3 py-4 text-left"
            style={{ border: "1px dashed var(--v-rule)", color: "var(--v-muted)" }}
          >
            <div className="mono text-[11px] tracking-widest">Noch keine Aufgaben angelegt.</div>
            {ctx.isOwner && (
              <div className="mono mt-2 text-[10px] tracking-widest" style={{ color: "var(--v-fg)" }}>
                + Eintrag hinzufügen
              </div>
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {m.packages.map((pkg, packageIndex) => {
                const slotLabel = pkg.label || `task-${packageIndex}`;
                const claimers = claimsByPackage.get(slotLabel) || [];
                const mine = claimers.some((entry) => entry.actor.id === myId);
                return (
                  <motion.div
                    key={`${packageIndex}-${pkg.label || "empty"}`}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
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
                        onClick={() => toggleClaim(slotLabel)}
                        aria-label={mine ? "Zuteilung aufheben" : "Mir zuweisen"}
                        className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-all"
                        style={{
                          border: `1.5px solid ${mine ? "var(--v-fg)" : "var(--v-rule)"}`,
                          background: mine ? "var(--v-fg)" : "transparent",
                        }}
                      >
                        {mine && (
                          <span className="mono text-[9px]" style={{ color: "var(--v-bg)" }}>
                            ✓
                          </span>
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <InlineText
                          value={pkg.label}
                          isOwner={ctx.isOwner}
                          onSave={(next) => setPackage(packageIndex, { label: next })}
                          placeholder="Aufgabe benennen"
                          className="block text-[13px] leading-snug"
                        />

                        {(ctx.isOwner || pkg.description) && (
                          <div className="mt-1.5">
                            <InlineText
                              value={pkg.description ?? ""}
                              isOwner={ctx.isOwner}
                              onSave={(next) => setPackage(packageIndex, { description: next })}
                              placeholder="Was muss hier passieren?"
                              multiline
                              className="text-[12px] leading-snug"
                            />
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap gap-2">
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
                        </div>
                      </div>

                      {ctx.isOwner && (
                        <button
                          type="button"
                          onClick={() => removePackage(packageIndex)}
                          aria-label="Aufgabe entfernen"
                          className="mono rounded-full px-2 py-1 text-[12px] transition-opacity hover:opacity-100"
                          style={{ border: "1px solid var(--v-rule)", color: "var(--v-muted)", opacity: 0.72 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {ctx.isOwner && m.packages.length > 0 && (
          <button
            type="button"
            onClick={addPackage}
            className="mono mt-3 rounded-full px-3 py-1 text-[10px] tracking-widest transition-opacity hover:opacity-100"
            style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)", opacity: 0.72 }}
          >
            + Eintrag hinzufügen
          </button>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}
