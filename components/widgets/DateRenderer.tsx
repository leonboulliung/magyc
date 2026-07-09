"use client";

import { useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import { useT } from "@/components/i18n/LocaleProvider";
import type { DateWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * Datum — a single day (no time-of-day). Renders a tear-off calendar
 * card with the day number large, weekday + month in mono.
 *
 * Owner can edit via a native <input type="date"> revealed on click.
 * No regenerate — this is a user-confirmed data point.
 */
export function DateRenderer({
  module: m,
  index,
}: {
  module: DateWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const tr = useT();
  const [editing, setEditing] = useState(false);

  async function save(next: string) {
    setEditing(false);
    if (next === m.date) return;
    await ctx.saveModule(index, { ...m, date: next });
  }

  const parts = formatDate(m.date, ctx.language);

  return (
    <WidgetShell module={m} index={index}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <div className="flex min-h-[190px] -translate-y-1 items-center justify-center py-2">
          {editing ? (
            <input
              autoFocus
              type="date"
              defaultValue={m.date}
              onBlur={(e) => save(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); save((e.target as HTMLInputElement).value); }
                else if (e.key === "Escape") { setEditing(false); }
              }}
              className="bg-transparent outline-none mono text-[13px] text-center"
              style={{ color: "var(--v-fg)", border: "1px solid var(--v-rule)", borderRadius: "var(--v-radius)", padding: "6px 10px" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => { if (ctx.isOwner) setEditing(true); }}
              disabled={!ctx.isOwner}
              className="w-full text-center leading-none"
              style={{ cursor: ctx.isOwner ? "text" : "default" }}
            >
              {m.date ? <>
                {/* Locale-formatted date differs server (UTC) vs client (local
                    TZ); suppress the hydration mismatch (React #418). */}
                <div suppressHydrationWarning className="mono text-[11px] tracking-[0.28em] opacity-60" style={{ color: "var(--v-muted)" }}>{parts.weekday}</div>
                <div suppressHydrationWarning className="mt-2 font-black text-[64px] leading-none" style={{ color: "var(--v-fg)" }}>{parts.day}</div>
                <div suppressHydrationWarning className="mono mt-2 text-[12px] tracking-[0.26em]" style={{ color: "var(--v-muted)" }}>{parts.monthYear}</div>
              </> : <span className="mono rounded-full px-3 py-1.5 text-[10px] tracking-widest opacity-70" style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}>{tr.elements.setDate}</span>}
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

function formatDate(iso: string, lang: string): { weekday: string; day: string; monthYear: string } {
  try {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) throw new Error("bad");
    const locale = lang || undefined;
    return {
      weekday: d.toLocaleDateString(locale, { weekday: "short" }).toUpperCase(),
      day: d.toLocaleDateString(locale, { day: "numeric" }),
      monthYear: d.toLocaleDateString(locale, { month: "short", year: "numeric" }).toUpperCase(),
    };
  } catch {
    return { weekday: "—", day: iso || "—", monthYear: "—" };
  }
}
