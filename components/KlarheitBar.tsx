"use client";

import type { Card } from "@/lib/types";
import { computeKlarheit, type KlarheitLevel } from "@/lib/klarheit";

/**
 * KlarheitBar — five small bricks visualizing how legible this thing
 * already is. The bricks fill ink-dark for present, hairline for
 * missing. Beside them, a single status word (Offen / Fast klar /
 * Klar / Sehr klar) and a one-line hint of what's still missing.
 *
 * Stays out of the way visually — it's mono, hairline, no color.
 * The pin carries the color; the bar carries the status.
 */
export function KlarheitBar({
  card,
  align = "left",
  showMissing = true,
}: {
  card: Card;
  align?: "left" | "right";
  showMissing?: boolean;
}) {
  const k = computeKlarheit(card);
  const filled = k.bricks;
  const total = k.outOf;

  return (
    <div
      className={`flex flex-col gap-1.5 ${align === "right" ? "items-end" : "items-start"}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-[3px]" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`block h-2 w-3 rounded-[1px] transition-colors ${
                i < filled
                  ? "bg-ink"
                  : "border border-rule-strong bg-paper"
              }`}
            />
          ))}
        </div>
        <span className="mono text-[10px] tracking-widest uppercase opacity-80">
          {k.label}
        </span>
      </div>
      {showMissing && k.missing.length > 0 && k.level !== "sharp" && (
        <span className="mono text-[10px] tracking-widest opacity-50">
          Noch offen: {k.missing.slice(0, 2).join(" · ")}
          {k.missing.length > 2 && " …"}
        </span>
      )}
    </div>
  );
}

/** Compact one-line variant — just the bricks + status word. For lists. */
export function KlarheitChip({ card }: { card: Card }) {
  const k = computeKlarheit(card);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex items-center gap-[2px]" aria-hidden>
        {Array.from({ length: k.outOf }).map((_, i) => (
          <span
            key={i}
            className={`block h-1.5 w-2 rounded-[1px] ${
              i < k.bricks ? "bg-ink" : "border border-rule-strong bg-paper"
            }`}
          />
        ))}
      </span>
      <span className="mono text-[10px] tracking-widest uppercase opacity-70">
        {labelFor(k.level)}
      </span>
    </span>
  );
}

function labelFor(level: KlarheitLevel): string {
  switch (level) {
    case "open":
      return "OFFEN";
    case "almost":
      return "FAST KLAR";
    case "clear":
      return "KLAR";
    case "sharp":
      return "SEHR KLAR";
  }
}
