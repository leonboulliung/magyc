/**
 * Module registry — sanitizers + meta.
 *
 * Every module that lands in `spaces.modules` flows through
 * `sanitizeModule()`. The AI is liberal about JSON shapes; we are
 * strict about what we store. Anything that doesn't fit a known type
 * is silently dropped — the UI never has to null-guard.
 *
 * The meta table maps each type to its data source label + whether
 * attribution is required. Used by the renderer to slot a uniform
 * attribution row.
 */

import { ALL_MODULE_TYPES, type FrameworkKind, type Module, type ModuleType } from "./types";

// ============================================================
// Sanitizer
// ============================================================

const ALLOWED = new Set<string>(ALL_MODULE_TYPES);

function clean(s: unknown, max: number): string {
  return typeof s === "string"
    ? s.trim().replace(/\s+/g, " ").slice(0, max)
    : "";
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function stringArray(raw: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const s = clean(v, maxLen);
    if (s) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function attribution(raw: unknown): Module["attribution"] {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const name = clean(r.name, 120);
  const url = clean(r.url, 300);
  const license = clean(r.license, 60);
  if (!name || !url) return undefined;
  return { name, url, license: license || "—" };
}

function base(raw: Record<string, unknown>): {
  label: string;
  description?: string;
  attribution?: Module["attribution"];
} {
  return {
    label: clean(raw.label, 80) || "—",
    description: clean(raw.description, 200) || undefined,
    attribution: attribution(raw.attribution),
  };
}

/**
 * Validate + shape-coerce a single module. Returns null on
 * unrecognized or unfixable shapes.
 */
export function sanitizeModule(raw: unknown): Module | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.type !== "string" || !ALLOWED.has(r.type)) return null;
  const b = base(r);
  const type = r.type as ModuleType;

  switch (type) {
    case "headline": {
      const title = clean(r.title, 120);
      if (!title) return null;
      const subtitle = clean(r.subtitle, 160) || undefined;
      return { type, ...b, title, subtitle };
    }
    case "tags": {
      const tags = stringArray(r.tags, 8, 40);
      if (tags.length === 0) return null;
      return { type, ...b, tags };
    }
    case "notes": {
      const text = typeof r.text === "string" ? r.text.slice(0, 4000) : "";
      return { type, ...b, text };
    }
    case "open_question": {
      const prompt = clean(r.prompt, 240);
      if (!prompt) return null;
      return { type, ...b, prompt };
    }
    case "poll": {
      const question = clean(r.question, 200);
      const options = stringArray(r.options, 6, 80);
      if (!question || options.length < 2) return null;
      return { type, ...b, question, options };
    }
    case "checklist": {
      const itemsRaw = Array.isArray(r.items) ? r.items : [];
      const items: { text: string }[] = [];
      for (const it of itemsRaw) {
        if (!it) continue;
        if (typeof it === "string") {
          const t = clean(it, 200);
          if (t) items.push({ text: t });
        } else if (typeof it === "object") {
          const t = clean((it as { text?: unknown }).text, 200);
          if (t) items.push({ text: t });
        }
        if (items.length >= 12) break;
      }
      if (items.length === 0) return null;
      return { type, ...b, items };
    }
    case "help_slots": {
      const slotsRaw = Array.isArray(r.slots) ? r.slots : [];
      const slots: { label: string }[] = [];
      for (const it of slotsRaw) {
        if (!it) continue;
        if (typeof it === "string") {
          const l = clean(it, 80);
          if (l) slots.push({ label: l });
        } else if (typeof it === "object") {
          const l = clean((it as { label?: unknown }).label, 80);
          if (l) slots.push({ label: l });
        }
        if (slots.length >= 8) break;
      }
      if (slots.length === 0) return null;
      return { type, ...b, slots };
    }
    case "stages": {
      const stages = stringArray(r.stages, 8, 40);
      if (stages.length < 2) return null;
      const current = num(r.current, 0, 0, stages.length - 1);
      return { type, ...b, stages, current };
    }
    case "number_block": {
      const value = clean(r.value, 24);
      if (!value) return null;
      const caption = clean(r.caption, 80) || undefined;
      return { type, ...b, value, caption };
    }
    case "icon": {
      const iconify = clean(r.iconify, 80);
      // Iconify identifiers look like "set:name", e.g. "lucide:book-open".
      if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(iconify)) return null;
      const size = num(r.size, 48, 16, 240);
      return { type, ...b, iconify, size };
    }
    case "palette": {
      const hue = clean(r.hue, 24).toLowerCase();
      if (!hue) return null;
      const stepsRaw = Array.isArray(r.steps) ? r.steps : null;
      const steps = stepsRaw
        ? stepsRaw
            .filter((n): n is number => typeof n === "number")
            .map((n) => Math.round(n))
            .filter((n) => n >= 0 && n <= 12)
            .slice(0, 6)
        : undefined;
      return { type, ...b, hue, steps };
    }
    case "map": {
      const c = r.center;
      if (!Array.isArray(c) || c.length !== 2) return null;
      const lng = typeof c[0] === "number" ? c[0] : NaN;
      const lat = typeof c[1] === "number" ? c[1] : NaN;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
      const zoom = num(r.zoom, 11, 1, 18);
      const markersRaw = Array.isArray(r.markers) ? r.markers : [];
      const markers: { lng: number; lat: number; label?: string }[] = [];
      for (const m of markersRaw) {
        if (!m || typeof m !== "object") continue;
        const mr = m as Record<string, unknown>;
        const mlng = typeof mr.lng === "number" ? mr.lng : NaN;
        const mlat = typeof mr.lat === "number" ? mr.lat : NaN;
        if (!Number.isFinite(mlng) || !Number.isFinite(mlat)) continue;
        const label = clean(mr.label, 80) || undefined;
        markers.push(label ? { lng: mlng, lat: mlat, label } : { lng: mlng, lat: mlat });
        if (markers.length >= 8) break;
      }
      return { type, ...b, center: [lng, lat], zoom, markers: markers.length ? markers : undefined };
    }
    case "time": {
      const mode = r.mode;
      if (mode !== "date" && mode !== "countdown" && mode !== "timeline") return null;
      const date = clean(r.date, 40) || undefined;
      const timezone = clean(r.timezone, 60) || undefined;
      const entriesRaw = Array.isArray(r.entries) ? r.entries : [];
      const entries: { date: string; label: string }[] = [];
      for (const e of entriesRaw) {
        if (!e || typeof e !== "object") continue;
        const er = e as Record<string, unknown>;
        const d = clean(er.date, 40);
        const l = clean(er.label, 80);
        if (d && l) entries.push({ date: d, label: l });
        if (entries.length >= 8) break;
      }
      // For "date" and "countdown" we need a date. For "timeline" we
      // accept either a date+entries or just entries.
      if ((mode === "date" || mode === "countdown") && !date) return null;
      if (mode === "timeline" && entries.length === 0 && !date) return null;
      return { type, ...b, mode, date, entries: entries.length ? entries : undefined, timezone };
    }
    case "knowledge": {
      const topic = clean(r.topic, 120);
      if (!topic) return null;
      const source = r.source === "wikidata" ? "wikidata" : "wikipedia";
      const showRaw = Array.isArray(r.show) ? r.show : [];
      const show: ("summary" | "thumb" | "facts")[] = [];
      for (const s of showRaw) {
        if (s === "summary" || s === "thumb" || s === "facts") show.push(s);
      }
      if (show.length === 0) show.push("summary");
      return { type, ...b, topic, source, show };
    }
    case "framework": {
      const kind = r.kind;
      const valid = ["okr", "scqa", "eisenhower", "rice", "kanban", "adr", "rfc", "postmortem", "faq", "one_pager"] as const;
      if (typeof kind !== "string" || !(valid as readonly string[]).includes(kind)) return null;
      const prefillRaw = (r.prefill && typeof r.prefill === "object") ? r.prefill as Record<string, unknown> : {};
      const prefill: Record<string, string> = {};
      for (const [k, v] of Object.entries(prefillRaw)) {
        const key = clean(k, 32);
        const value = typeof v === "string" ? v.trim().slice(0, 800) : "";
        if (key && value) prefill[key] = value;
      }
      return { type, ...b, kind: kind as FrameworkKind, prefill };
    }
    case "typography": {
      const heading = clean(r.heading, 60);
      const body = clean(r.body, 60);
      if (!heading || !body) return null;
      return { type, ...b, heading, body };
    }
    case "formula": {
      const latex = typeof r.latex === "string" ? r.latex.slice(0, 600) : "";
      if (!latex) return null;
      const display = r.display === "block" ? "block" : "inline";
      return { type, ...b, latex, display };
    }
    case "chart": {
      const chartType = r.chartType;
      if (chartType !== "bar" && chartType !== "line" && chartType !== "area") return null;
      const dataRaw = Array.isArray(r.data) ? r.data : [];
      const data: { x: string; y: number }[] = [];
      for (const d of dataRaw) {
        if (!d || typeof d !== "object") continue;
        const dr = d as Record<string, unknown>;
        const x = clean(dr.x, 24);
        const y = typeof dr.y === "number" && Number.isFinite(dr.y) ? dr.y : NaN;
        if (x && Number.isFinite(y)) data.push({ x, y });
        if (data.length >= 24) break;
      }
      if (data.length < 2) return null;
      const xLabel = clean(r.xLabel, 40) || undefined;
      const yLabel = clean(r.yLabel, 40) || undefined;
      return { type, ...b, chartType, data, xLabel, yLabel };
    }
    case "image": {
      const url = clean(r.url, 500);
      if (!/^https?:\/\/[^\s]+$/i.test(url)) return null;
      const alt = clean(r.alt, 200) || undefined;
      return { type, ...b, url, alt };
    }
  }
}

/** Sanitize a list of module candidates. Drops invalid ones, caps at
 *  10 total to keep a space readable. */
export function sanitizeModules(raw: unknown): Module[] {
  if (!Array.isArray(raw)) return [];
  const out: Module[] = [];
  for (const item of raw) {
    const m = sanitizeModule(item);
    if (m) out.push(m);
    if (out.length >= 10) break;
  }
  return out;
}

// ============================================================
// Meta — used by the renderer for attribution rows + data hints
// ============================================================

export interface ModuleMeta {
  /** Human-readable source label, displayed in tiny mono near the module. */
  dataSource: string | null;
  /** Whether the source mandates a visible attribution. */
  requiresAttribution: boolean;
}

export const MODULE_META: Record<ModuleType, ModuleMeta> = {
  headline:      { dataSource: null,                   requiresAttribution: false },
  tags:          { dataSource: null,                   requiresAttribution: false },
  notes:         { dataSource: null,                   requiresAttribution: false },
  open_question: { dataSource: null,                   requiresAttribution: false },
  poll:          { dataSource: null,                   requiresAttribution: false },
  checklist:     { dataSource: null,                   requiresAttribution: false },
  help_slots:    { dataSource: null,                   requiresAttribution: false },
  stages:        { dataSource: null,                   requiresAttribution: false },
  number_block:  { dataSource: null,                   requiresAttribution: false },
  icon:          { dataSource: "Iconify",              requiresAttribution: false },
  palette:       { dataSource: "Open Props",           requiresAttribution: false },
  map:           { dataSource: "OpenStreetMap",        requiresAttribution: true  },
  time:          { dataSource: null,                   requiresAttribution: false },
  knowledge:     { dataSource: "Wikipedia / Wikidata", requiresAttribution: true  },
  framework:     { dataSource: null,                   requiresAttribution: false },
  typography:    { dataSource: "Google Fonts",         requiresAttribution: false },
  formula:       { dataSource: "KaTeX",                requiresAttribution: false },
  chart:         { dataSource: "Observable Plot",      requiresAttribution: false },
  image:         { dataSource: "Wikimedia Commons",    requiresAttribution: true  },
};
