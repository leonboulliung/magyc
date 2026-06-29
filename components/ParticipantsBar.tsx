"use client";

import { motion } from "motion/react";
import type { ModuleStateEntry, Profile } from "@/lib/types";
import { ActorDot } from "./widgets/WidgetCard";
import { displayActorName } from "@/lib/state";

/**
 * ParticipantsBar — a strip near the top of a space showing everyone
 * involved: the owner plus every distinct actor who has contributed
 * any collaborative state (a vote, claim, note, message, upload, …).
 *
 * Each participant is a colored ActorDot; the colour is the one
 * snapshotted on their actions, so attribution stays consistent with
 * the rest of the surface. Hovering shows the name.
 */
interface Participant {
  id: string;
  name: string;
  color?: string;
}

export function ParticipantsBar({
  state,
  owner,
  self,
  label,
}: {
  state: ModuleStateEntry[];
  owner: Profile | null;
  /** The current viewer, shown immediately (before their first edit). */
  self?: { id: string; name: string; color?: string } | null;
  /** AI-generated heading ("people", "Beteiligte", …). Optional. */
  label?: string;
}) {
  // Collect distinct actors from state, newest contribution wins for
  // the colour snapshot.
  const byId = new Map<string, Participant>();

  if (owner) {
    byId.set(owner.id, {
      id: owner.id,
      name: owner.displayName,
      color: owner.color ?? undefined,
    });
  }

  if (self && !byId.has(self.id)) {
    byId.set(self.id, { id: self.id, name: self.name, color: self.color });
  }

  for (const e of state) {
    const id = e.actor.id;
    if (!id) continue;
    const color = typeof e.data.color === "string" ? (e.data.color as string) : undefined;
    const name = displayActorName(e.actor);
    const existing = byId.get(id);
    if (existing) {
      // Keep the name; refresh colour if we have one.
      if (color) existing.color = color;
    } else {
      byId.set(id, { id, name, color });
    }
  }

  const participants = [...byId.values()];
  if (participants.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="mono text-[9px] tracking-widest uppercase" style={{ color: "var(--v-muted)" }}>
          {label}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        {participants.slice(0, 12).map((p, i) => (
          <motion.span
            key={p.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22, delay: i * 0.03 }}
            title={p.name}
          >
            <ActorDot color={p.color} displayName={p.name} size={24} />
          </motion.span>
        ))}
        {participants.length > 12 && (
          <span
            className="mono text-[10px] tabular-nums ml-3"
            style={{ color: "var(--v-muted)" }}
          >
            +{participants.length - 12}
          </span>
        )}
      </div>
    </div>
  );
}
