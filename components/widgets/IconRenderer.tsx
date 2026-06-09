"use client";

import { Icon } from "@iconify/react";
import type { IconWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * Icon — single SVG icon from Iconify.
 *
 * The classifier picks an Iconify identifier (set:name). The regenerate
 * flow returns 6 candidates with a refresh button for 5 more — handled
 * by the shared WidgetShell + the per-icon suggestion preview rendered
 * here.
 *
 * No editing in the body besides regenerate. The icon visually carries
 * the workspace's semantic anchor; the microTitle is intentionally not
 * shown for this widget (per the type definition's comment in types.ts).
 */
export function IconRenderer({
  module: m,
  index,
}: {
  module: IconWidget;
  index: number;
}) {
  return (
    <WidgetShell
      module={m}
      index={index}
      renderSuggestion={(s) =>
        s.type === "icon" ? (
          <div className="flex items-center gap-2.5">
            <Icon icon={s.iconify} width={20} height={20} />
            <span className="mono text-[10px] tracking-widest opacity-70 truncate">
              {s.iconify}
            </span>
          </div>
        ) : null
      }
    >
      <WidgetCard description={m.description}>
        <div className="flex items-center justify-center py-3">
          <div
            className="inline-flex items-center justify-center rounded-md"
            style={{
              width: 72,
              height: 72,
              border: "1px solid var(--v-rule)",
              background: "var(--v-bg)",
              color: "var(--v-fg)",
            }}
          >
            <Icon icon={m.iconify} width={40} height={40} />
          </div>
        </div>
        <div className="mono text-[9px] tracking-widest text-center opacity-50" style={{ color: "var(--v-muted)" }}>
          {m.iconify}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}
