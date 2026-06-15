"use client";

import { motion, AnimatePresence } from "motion/react";
import type { DeliverablesWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

export function DeliverablesRenderer({
  module: m,
  index,
}: {
  module: DeliverablesWidget;
  index: number;
}) {
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
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {m.items.map((item) => {
              const meta = [item.quantity, item.format, item.due].filter(Boolean);
              return (
                <motion.div
                  key={`${item.label}-${item.quantity ?? ""}-${item.format ?? ""}-${item.due ?? ""}`}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-[var(--v-radius)] p-3"
                  style={{
                    border: "1px solid var(--v-rule)",
                    background: "rgba(255,255,255,0.65)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div className="text-[13px] leading-snug" style={{ color: "var(--v-fg)" }}>
                    {item.label}
                  </div>
                  {meta.length > 0 && (
                    <div className="mono text-[10px] tracking-widest mt-1 opacity-60" style={{ color: "var(--v-muted)" }}>
                      {meta.join(" · ")}
                    </div>
                  )}
                  {item.details && (
                    <div className="text-[12px] leading-snug mt-2" style={{ color: "var(--v-muted)" }}>
                      {item.details}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}
