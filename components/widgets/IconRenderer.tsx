"use client";

import { Icon } from "@iconify/react";
import type { IconWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";

/**
 * Icon — single SVG icon from Iconify.
 *
 * Rendered as a COMPACT square tile: the icon fills its area, no card
 * chrome, no identifier label. The icon visually carries the
 * workspace's semantic anchor, so it earns its space by being the
 * content — not by sitting in a big padded card.
 *
 * The ⇆ alternatives affordance (6 candidates + refresh) is provided
 * by the shared WidgetShell on hover; the microTitle is intentionally
 * not shown (per the type definition's comment in types.ts).
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
      regenerateGlyph="⇆"
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
      {/* Compact square — small fixed tile the icon nearly fills, so
          the widget hugs its content instead of padding a big card. */}
      <div
        className="inline-flex items-center justify-center rounded-[var(--v-radius)]"
        style={{
          width: 84,
          height: 84,
          border: "1px solid var(--v-widget-border, var(--v-rule))",
          background: "var(--v-widget, var(--v-bg))",
          color: "var(--v-fg)",
        }}
      >
        <Icon icon={m.iconify} width={52} height={52} />
      </div>
    </WidgetShell>
  );
}
