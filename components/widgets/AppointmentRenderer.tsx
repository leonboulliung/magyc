"use client";

import { useState } from "react";
import { useMounted } from "@/lib/useMounted";
import { useWidgetContext } from "@/lib/widgetContext";
import { useT } from "@/components/i18n/LocaleProvider";
import type { AppointmentWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * Ein Termin — single date+time. Shows date prominently with a clock
 * line underneath. Owner can edit via native datetime-local input.
 */
export function AppointmentRenderer({
  module: m,
  index,
}: {
  module: AppointmentWidget;
  index: number;
}) {
  const ctx = useWidgetContext();
  const tr = useT();
  const [editing, setEditing] = useState(false);
  // Until mounted, format in UTC so the server HTML and the first client render
  // agree (no hydration mismatch); after mount, switch to the viewer's local
  // timezone so the appointment shows the wall-time the owner actually picked.
  const mounted = useMounted();

  async function save(next: string) {
    setEditing(false);
    const datetime = next ? new Date(next).toISOString() : "";
    if (datetime === m.datetime) return;
    const updated = { ...m, datetime };
    await ctx.saveModule(index, updated);
  }

  const parts = formatDateTime(m.datetime, ctx.language, mounted ? undefined : "UTC");
  const inputValue = toLocalInputValue(m.datetime);

  return (
    <WidgetShell module={m} index={index}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <div className="flex min-h-[180px] items-center justify-center py-4">
          {editing ? (
            <input
              autoFocus
              type="datetime-local"
              defaultValue={inputValue}
              onBlur={(e) => save(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); save((e.target as HTMLInputElement).value); }
                else if (e.key === "Escape") setEditing(false);
              }}
              className="bg-transparent outline-none mono text-[12px]"
              style={{ color: "var(--v-fg)", border: "1px solid var(--v-rule)", borderRadius: "var(--v-radius)", padding: "6px 10px" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => { if (ctx.isOwner) setEditing(true); }}
              disabled={!ctx.isOwner}
              className="w-full text-center"
              style={{ cursor: ctx.isOwner ? "text" : "default" }}
            >
              {m.datetime ? <div className="leading-none">
                {/* Date/time is locale + timezone dependent: the server (UTC)
                    and the browser (local TZ) format it differently, which
                    would throw a hydration mismatch (React #418) and destabilise
                    the whole subtree. suppressHydrationWarning tells React the
                    difference is intentional — the client value wins after
                    hydration, no error, no freeze. */}
                <div suppressHydrationWarning className="mono text-[11px] tracking-[0.28em] opacity-60" style={{ color: "var(--v-muted)" }}>
                  {parts.weekday}
                </div>
                <div suppressHydrationWarning className="mt-2 font-black text-[56px] leading-none" style={{ color: "var(--v-fg)" }}>
                  {parts.day}
                </div>
                <div suppressHydrationWarning className="mono mt-2 text-[12px] tracking-[0.24em]" style={{ color: "var(--v-muted)" }}>
                  {parts.monthYear}
                </div>
                <div suppressHydrationWarning className="mono mt-4 text-[18px] tracking-[0.18em]" style={{ color: "var(--v-fg)" }}>
                  {parts.time}
                </div>
                {m.timezone && (
                  <div className="mono mt-1 text-[10px] tracking-[0.16em] opacity-60" style={{ color: "var(--v-muted)" }}>
                    {m.timezone}
                  </div>
                )}
              </div> : <span className="mono rounded-full px-3 py-1.5 text-[10px] tracking-widest opacity-70" style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}>{tr.elements.setAppointment}</span>}
            </button>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

function formatDateTime(iso: string, lang: string, timeZone?: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error("bad");
    const locale = lang || undefined;
    const tz = timeZone ? { timeZone } : {};
    return {
      weekday: d.toLocaleDateString(locale, { weekday: "short", ...tz }).toUpperCase(),
      day: d.toLocaleDateString(locale, { day: "numeric", ...tz }),
      monthYear: d.toLocaleDateString(locale, { month: "short", year: "numeric", ...tz }).toUpperCase(),
      time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", ...tz }),
    };
  } catch {
    return { weekday: "—", day: "—", monthYear: "—", time: iso || "—" };
  }
}

function toLocalInputValue(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    // datetime-local expects YYYY-MM-DDTHH:mm in local time
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}
