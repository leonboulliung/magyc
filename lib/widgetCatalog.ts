import type { Module, ModuleType } from "@/lib/types";

export interface WidgetPickerEntry { type: ModuleType; symbol: string }

/** Canonical project/preset element order and symbols. */
export const WIDGET_PICKER_GROUPS: { symbol: string; entries: WidgetPickerEntry[] }[] = [
  { symbol: "▧", entries: [
    { type: "moodboard", symbol: "▧" }, { type: "shot_list", symbol: "▤" },
    { type: "images", symbol: "▨" }, { type: "attachments", symbol: "□" },
    { type: "parts_list", symbol: "≡" },
  ] },
  { symbol: "↩", entries: [
    { type: "notes", symbol: "≡" }, { type: "qa", symbol: "?" }, { type: "poll", symbol: "○" },
  ] },
  { symbol: "●", entries: [
    { type: "crew", symbol: "●" }, { type: "work_packages", symbol: "□" },
    { type: "deliverables", symbol: "≣" }, { type: "approvals", symbol: "✓" },
    { type: "checklist", symbol: "✓" },
  ] },
  { symbol: "▤", entries: [
    { type: "date", symbol: "▤" }, { type: "appointment", symbol: "◷" },
    { type: "appointments", symbol: "▦" }, { type: "phases", symbol: "→" },
  ] },
  { symbol: "⊙", entries: [
    { type: "locations_multi", symbol: "⊙⊙" }, { type: "location_suggestions", symbol: "◎" },
  ] },
  { symbol: "▦", entries: [{ type: "table", symbol: "▦" }] },
  { symbol: "✦", entries: [
    { type: "ai_summary", symbol: "✦" }, { type: "audio", symbol: "♫" }, { type: "sketch", symbol: "○" },
  ] },
];

export function widgetPickerSymbolFor(type: ModuleType): string {
  for (const group of WIDGET_PICKER_GROUPS) {
    const entry = group.entries.find((item) => item.type === type);
    if (entry) return entry.symbol;
  }
  return "□";
}

export function widgetPickerGroups(): ModuleType[][] {
  return WIDGET_PICKER_GROUPS.map((group) => group.entries.map((entry) => entry.type));
}

/** Empty, editable configs only. No fabricated project content. */
export function defaultWidget(type: ModuleType): Module | null {
  switch (type) {
    case "ai_summary": return { type, text: "" };
    case "icon": return { type, iconify: "lucide:star" };
    case "wikipedia": return null;
    case "gif": return null;
    case "notes": return { type };
    case "qa": return { type };
    case "poll": return { type, question: "", options: [] };
    case "crew": return { type, roles: [] };
    case "work_packages": return { type, packages: [] };
    case "deliverables": return { type, items: [] };
    case "approvals": return { type, items: [] };
    case "checklist": return { type, items: [] };
    case "date": return { type, date: "" };
    case "appointment": return { type, datetime: "" };
    case "appointments": return { type, entries: [] };
    case "range": return null;
    case "phases": return { type, phases: [], currentPhase: 0 };
    case "location_single": return null;
    case "locations_multi": return { type, locations: [] };
    case "location_suggestions": return { type, suggestions: [] };
    case "route": return null;
    case "table": return { type, columns: [], rows: [] };
    case "shot_list": return { type, shots: [] };
    case "parts_list": return { type, items: [] };
    case "attachments": return { type };
    case "images": return { type };
    case "moodboard": return { type, directions: [] };
    case "selection": return null;
    case "audio": return { type };
    case "sketch": return { type };
    default: return null;
  }
}
