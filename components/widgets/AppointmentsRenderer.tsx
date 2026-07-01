"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { AppointmentsWidget } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";

/**
 * Mehrere Termine — chronological list of dated entries. Owner can
 * edit each entry's datetime + label and add / remove rows.
 *
 * Sorted ascending by datetime on render so the list is always in
 * chronological order regardless of how the AI seeded it.
 */
export function AppointmentsRenderer({
  module: m,
  index,
}: {
  module: AppointmentsWidget;
  index: number;
}) {
  const ctx = useWidgetContext();

  async function save(next: AppointmentsWidget) {
    await ctx.saveModule(index, next);
  }

  const sortedEntries = [...m.entries]
    .map((e, originalIndex) => ({ ...e, originalIndex }))
    .sort((a, b) => {
      const ta = Date.parse(a.datetime);
      const tb = Date.parse(b.datetime);
      if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
      return ta - tb;
    });

  function updateEntry(originalIndex: number, patch: Partial<{ datetime: string; label: string }>) {
    const entries = m.entries.map((e, i) => {
      if (i !== originalIndex) return e;
      const parsed = patch.datetime ? new Date(patch.datetime) : null;
      const dt = parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : e.datetime;
      const label = patch.label !== undefined ? patch.label : e.label;
      return { ...e, datetime: dt, label };
    });
    save({ ...m, entries });
  }

  function addEntry() {
    const now = new Date();
    now.setMinutes(0); now.setSeconds(0); now.setMilliseconds(0);
    save({
      ...m,
      entries: [...m.entries, { datetime: now.toISOString(), label: "" }],
    });
  }

  function removeEntry(originalIndex: number) {
    save({ ...m, entries: m.entries.filter((_, i) => i !== originalIndex) });
  }

  return (
    <WidgetShell module={m} index={index}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {sortedEntries.map((e) => (
              <motion.li
                key={e.originalIndex}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
              >
                <EntryRow
                  datetime={e.datetime}
                  label={e.label}
                  language={ctx.language}
                  isOwner={ctx.isOwner}
                  onChange={(patch) => updateEntry(e.originalIndex, patch)}
                  onRemove={() => removeEntry(e.originalIndex)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {ctx.isOwner && (
          <div className="mt-3">
            <button
              type="button"
              onClick={addEntry}
              className="mono text-[10px] tracking-widest px-3 py-1 rounded-full opacity-60 hover:opacity-100"
              style={{ border: "1px dashed var(--v-rule)", color: "var(--v-fg)" }}
            >
              {m.entries.length === 0 ? "+ Ersten Termin hinzufügen" : "+ Termin hinzufügen"}
            </button>
          </div>
        )}
      </WidgetCard>
    </WidgetShell>
  );
}

function EntryRow({
  datetime,
  label,
  language,
  isOwner,
  onChange,
  onRemove,
}: {
  datetime: string;
  label?: string;
  language: string;
  isOwner: boolean;
  onChange: (patch: Partial<{ datetime: string; label: string }>) => void;
  onRemove: () => void;
}) {
  const [editingTime, setEditingTime] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [hover, setHover] = useState(false);

  const parts = formatDateTime(datetime, language);
  const inputValue = toLocalInputValue(datetime);

  return (
    <div
      className="flex items-center gap-3 px-1 py-1.5"
      style={{ borderBottom: "1px solid var(--v-rule)" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Mini date column */}
      {editingTime ? (
        <input
          autoFocus
          type="datetime-local"
          defaultValue={inputValue}
          onBlur={(e) => { setEditingTime(false); onChange({ datetime: e.target.value }); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onChange({ datetime: (e.target as HTMLInputElement).value }); setEditingTime(false); }
            else if (e.key === "Escape") setEditingTime(false);
          }}
          className="bg-transparent outline-none mono text-[11px]"
              style={{ color: "var(--v-fg)", border: "1px solid var(--v-rule)", borderRadius: "var(--v-radius)", padding: "3px 6px" }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { if (isOwner) setEditingTime(true); }}
          disabled={!isOwner}
          className="shrink-0 text-left leading-none w-16"
          style={{ cursor: isOwner ? "text" : "default" }}
        >
          <div className="mono text-[9px] tracking-widest opacity-60" style={{ color: "var(--v-muted)" }}>
            {parts.weekday}
          </div>
          <div className="font-black text-[18px] leading-none mt-0.5" style={{ color: "var(--v-fg)" }}>
            {parts.day}
          </div>
          <div className="mono text-[9px] tracking-widest mt-0.5" style={{ color: "var(--v-muted)" }}>
            {parts.monthYear}
          </div>
          <div className="mono text-[10px] mt-1 tabular-nums" style={{ color: "var(--v-fg)" }}>
            {parts.time}
          </div>
        </button>
      )}

      {/* Label */}
      <div className="flex-1 min-w-0">
        {editingLabel ? (
          <input
            autoFocus
            defaultValue={label ?? ""}
            onBlur={(e) => { setEditingLabel(false); onChange({ label: e.target.value }); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); onChange({ label: (e.target as HTMLInputElement).value }); setEditingLabel(false); }
              else if (e.key === "Escape") setEditingLabel(false);
            }}
            placeholder="Termin benennen"
            maxLength={120}
            className="w-full text-[13px] bg-transparent outline-none px-2 py-1 rounded-[var(--v-radius)]"
            style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
          />
        ) : (
          <div
            onClick={() => { if (isOwner) setEditingLabel(true); }}
            className="text-[13px]"
            style={{
              cursor: isOwner ? "text" : "default",
              color: label ? "var(--v-fg)" : "var(--v-muted)",
            }}
          >
            {label || "Termin benennen"}
          </div>
        )}
      </div>

      <AnimatePresence>
        {hover && isOwner && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onRemove}
            aria-label="Termin entfernen"
            className="mono text-[12px] opacity-60 hover:opacity-100"
            style={{ color: "var(--v-fg)" }}
          >
            ×
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatDateTime(iso: string, lang: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error("bad");
    const locale = lang || undefined;
    return {
      weekday: d.toLocaleDateString(locale, { weekday: "short" }).toUpperCase(),
      day: d.toLocaleDateString(locale, { day: "numeric" }),
      monthYear: d.toLocaleDateString(locale, { month: "short" }).toUpperCase(),
      time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
    };
  } catch {
    return { weekday: "—", day: "—", monthYear: "—", time: iso || "—" };
  }
}

function toLocalInputValue(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}
