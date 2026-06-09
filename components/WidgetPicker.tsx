"use client";

import { motion, AnimatePresence } from "motion/react";
import type { Module, ModuleType } from "@/lib/types";

/**
 * WidgetPicker — a compact dropdown listing all 26 body widget types,
 * grouped by domain. Clicking a type calls onPick with a sensible
 * default config for that type.
 */

interface PickerEntry {
  type: ModuleType;
  symbol: string;
  label: string;
}

const GROUPS: { label: string; entries: PickerEntry[] }[] = [
  {
    label: "Content",
    entries: [
      { type: "ai_summary",          symbol: "✦", label: "AI summary" },
      { type: "icon",                symbol: "◈", label: "Icon" },
      { type: "wikipedia",           symbol: "W", label: "Wikipedia" },
      { type: "gif",                 symbol: "▷", label: "GIF" },
    ],
  },
  {
    label: "Collaboration",
    entries: [
      { type: "notes",               symbol: "≡", label: "Notes" },
      { type: "discussion",          symbol: "↩", label: "Discussion" },
      { type: "qa",                  symbol: "?", label: "Q&A" },
      { type: "poll",                symbol: "○", label: "Poll" },
    ],
  },
  {
    label: "Team",
    entries: [
      { type: "crew",                symbol: "●", label: "Crew" },
      { type: "work_packages",       symbol: "□", label: "Work packages" },
      { type: "checklist",           symbol: "✓", label: "Checklist" },
    ],
  },
  {
    label: "Time",
    entries: [
      { type: "date",                symbol: "▤", label: "Date" },
      { type: "appointment",         symbol: "⏱", label: "Appointment" },
      { type: "appointments",        symbol: "▦", label: "Schedule" },
      { type: "range",               symbol: "↔", label: "Range" },
      { type: "phases",              symbol: "→", label: "Phases" },
    ],
  },
  {
    label: "Place",
    entries: [
      { type: "location_single",     symbol: "⊙", label: "Location" },
      { type: "locations_multi",     symbol: "⊙⊙", label: "Locations" },
      { type: "location_suggestions",symbol: "◎", label: "Location ideas" },
      { type: "route",               symbol: "⟶", label: "Route" },
    ],
  },
  {
    label: "Data",
    entries: [
      { type: "table",               symbol: "▦", label: "Table" },
      { type: "parts_list",          symbol: "≡", label: "Parts list" },
    ],
  },
  {
    label: "Media",
    entries: [
      { type: "attachments",         symbol: "□", label: "Attachments" },
      { type: "images",              symbol: "▨", label: "Images" },
      { type: "audio",               symbol: "♫", label: "Audio" },
      { type: "sketch",              symbol: "○", label: "Sketch" },
    ],
  },
];

function defaultWidget(type: ModuleType): Module | null {
  const now = new Date().toISOString();
  const today = now.split("T")[0];
  switch (type) {
    case "ai_summary":          return { type, text: "" };
    case "icon":                return { type, iconify: "lucide:star" };
    case "wikipedia":           return { type, topic: "…" };
    case "gif":                 return { type, gifUrl: "https://media.tenor.com/RoFLtN1WqOwAAAAC/loading.gif", thumbnailUrl: "" };
    case "notes":               return { type };
    case "discussion":          return { type };
    case "qa":                  return { type };
    case "poll":                return { type, question: "?", options: ["A", "B", "C"] };
    case "crew":                return { type, roles: [{ name: "…" }] };
    case "work_packages":       return { type, packages: [{ label: "…" }] };
    case "checklist":           return { type, items: [] };
    case "date":                return { type, date: today };
    case "appointment":         return { type, datetime: now };
    case "appointments":        return { type, entries: [] };
    case "range":               return { type, unit: "generic", from: "—", to: "—" };
    case "phases":              return { type, phases: [{ label: "I" }, { label: "II" }, { label: "III" }], currentPhase: 0 };
    case "location_single":     return { type, center: [2.3522, 48.8566], zoom: 13, label: "Paris" };
    case "locations_multi":     return { type, locations: [] };
    case "location_suggestions":return { type, suggestions: [] };
    case "route":               return { type, stops: [] };
    case "table":               return { type, columns: ["A", "B", "C"], rows: [["", "", ""]] };
    case "parts_list":          return { type, items: [] };
    case "attachments":         return { type };
    case "images":              return { type };
    case "audio":               return { type };
    case "sketch":              return { type };
    // Header widgets not offered through picker
    default: return null;
  }
}

export function WidgetPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (widget: Module) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-full mb-2 left-0 z-50 rounded-md overflow-hidden"
            style={{
              width: 280,
              background: "var(--v-bg)",
              border: "1px solid var(--v-rule)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              maxHeight: "60vh",
              overflowY: "auto",
            }}
          >
            {GROUPS.map((group) => (
              <div key={group.label}>
                <div
                  className="mono text-[9px] tracking-widest px-3 pt-3 pb-1.5"
                  style={{ color: "var(--v-muted)" }}
                >
                  {group.label.toUpperCase()}
                </div>
                <div className="grid grid-cols-2 gap-0.5 px-1.5 pb-1.5">
                  {group.entries.map((e) => (
                    <button
                      key={e.type}
                      type="button"
                      onClick={() => {
                        const w = defaultWidget(e.type);
                        if (w) { onPick(w); onClose(); }
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-left transition-colors hover:bg-black/[0.04]"
                    >
                      <span
                        className="mono text-[11px] shrink-0 w-4 text-center"
                        style={{ color: "var(--v-muted)" }}
                      >
                        {e.symbol}
                      </span>
                      <span className="text-[11px] truncate" style={{ color: "var(--v-fg)" }}>
                        {e.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
