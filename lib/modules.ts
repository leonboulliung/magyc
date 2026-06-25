/**
 * Module registry — sanitizers + meta for the 33 widget types.
 *
 * Every widget that lands in `spaces.modules` flows through
 * `sanitizeModule()`. The AI is liberal about JSON shapes; we are
 * strict about what we store. Anything that doesn't fit a known type
 * is silently dropped.
 *
 * MODULE_META carries the agent-facing semantics: when to use a
 * widget, whether it needs mandatory pre-creation config, which
 * external source feeds it, and what interactive surfaces it exposes.
 * The classifier prompt is built from this table at runtime.
 */

import { ALL_MODULE_TYPES, type Module, type ModuleType } from "./types";

// ============================================================
// Common helpers
// ============================================================

const ALLOWED = new Set<string>(ALL_MODULE_TYPES);
const DELIVERABLE_STATUSES = new Set(["planned", "in_progress", "ready", "delivered"]);
const APPROVAL_AUDIENCES = new Set(["client", "internal"]);
const APPROVAL_STATUSES = new Set(["pending", "requested", "approved"]);
const MOODBOARD_DIRECTION_STATUSES = new Set(["reference", "approved", "avoid"]);
const SHOT_PRIORITIES = new Set(["must", "should", "nice"]);
const SHOT_STATUSES = new Set(["planned", "captured", "selected"]);

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

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
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
  microTitle?: string;
  description?: string;
  attribution?: Module["attribution"];
} {
  const microTitle = (clean(raw.microTitle, 80) ? stripTags(clean(raw.microTitle, 80)) : undefined) || undefined;
  const description = clean(raw.description, 200) || undefined;
  return {
    microTitle,
    description,
    attribution: attribution(raw.attribution),
  };
}

// ============================================================
// Coord validation — shared by map family
// ============================================================

function validCoord(lng: unknown, lat: unknown): { lng: number; lat: number } | null {
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return { lng, lat };
}

// ============================================================
// Sanitizer
// ============================================================

export function sanitizeModule(raw: unknown): Module | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.type !== "string" || !ALLOWED.has(r.type)) return null;
  const b = base(r);
  const type = r.type as ModuleType;

  switch (type) {
    case "heading": {
      const text = clean(r.text, 200);
      const levelRaw = typeof r.level === "number" ? Math.floor(r.level) : 1;
      const level = (Math.max(1, Math.min(6, levelRaw))) as 1 | 2 | 3 | 4 | 5 | 6;
      const placeholder = clean(r.placeholder, 200) || undefined;
      return { type, ...b, text, level, placeholder };
    }
    case "rich_text": {
      const text = typeof r.text === "string" ? r.text.slice(0, 4000) : "";
      const placeholder = clean(r.placeholder, 240) || undefined;
      return { type, ...b, text, placeholder };
    }
    case "tags": {
      const tags = stringArray(r.tags, 12, 40);
      return { type, ...b, tags };
    }
    case "wikipedia": {
      const topic = clean(r.topic, 120);
      if (!topic) return null;
      const url = clean(r.url, 400) || undefined;
      const thumbnailUrl = clean(r.thumbnailUrl, 500) || undefined;
      const extract = clean(r.extract, 800) || undefined;
      return { type, ...b, topic, url, thumbnailUrl, extract };
    }
    case "ai_summary": {
      const text = typeof r.text === "string" ? r.text.trim().slice(0, 1200) : "";
      // Allow empty text for freshly-added widgets (AI_FILL_ON_ADD will author it)
      return { type, ...b, text };
    }
    case "icon": {
      const iconify = clean(r.iconify, 80);
      if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(iconify)) return null;
      return { type, ...b, iconify };
    }
    case "location_single": {
      const c = Array.isArray(r.center) ? r.center : null;
      if (!c || c.length !== 2) return null;
      const coord = validCoord(c[0], c[1]);
      if (!coord) return null;
      const zoom = num(r.zoom, 13, 1, 18);
      const label = clean(r.label, 120) || undefined;
      return { type, ...b, center: [coord.lng, coord.lat], zoom, label };
    }
    case "locations_multi": {
      const raw = Array.isArray(r.locations) ? r.locations : [];
      const locations: { lng: number; lat: number; label?: string }[] = [];
      for (const m of raw) {
        if (!m || typeof m !== "object") continue;
        const mr = m as Record<string, unknown>;
        const coord = validCoord(mr.lng, mr.lat);
        if (!coord) continue;
        const label = clean(mr.label, 120) || undefined;
        locations.push(label ? { ...coord, label } : coord);
        if (locations.length >= 24) break;
      }
      if (locations.length === 0) return null;
      return { type, ...b, locations };
    }
    case "location_suggestions": {
      const raw = Array.isArray(r.suggestions) ? r.suggestions : [];
      const suggestions: { label: string; address?: string; lng?: number; lat?: number }[] = [];
      for (const s of raw) {
        if (!s || typeof s !== "object") continue;
        const sr = s as Record<string, unknown>;
        const label = clean(sr.label, 120);
        if (!label) continue;
        const address = clean(sr.address, 200) || undefined;
        const coord = validCoord(sr.lng, sr.lat);
        suggestions.push({
          label,
          ...(address ? { address } : {}),
          ...(coord ? coord : {}),
        });
        if (suggestions.length >= 8) break;
      }
      if (suggestions.length === 0) return null;
      return { type, ...b, suggestions };
    }
    case "route": {
      const raw = Array.isArray(r.stops) ? r.stops : [];
      const stops: { lng: number; lat: number; label?: string }[] = [];
      for (const s of raw) {
        if (!s || typeof s !== "object") continue;
        const sr = s as Record<string, unknown>;
        const coord = validCoord(sr.lng, sr.lat);
        if (!coord) continue;
        const label = clean(sr.label, 120) || undefined;
        stops.push(label ? { ...coord, label } : coord);
        if (stops.length >= 20) break;
      }
      if (stops.length < 2) return null; // a route needs at least two ends
      return { type, ...b, stops };
    }
    case "date": {
      const date = clean(r.date, 40);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { type, ...b, date };
    }
    case "appointment": {
      const datetime = clean(r.datetime, 60);
      if (!Number.isFinite(Date.parse(datetime))) return null;
      const timezone = clean(r.timezone, 60) || undefined;
      return { type, ...b, datetime, timezone };
    }
    case "appointments": {
      const raw = Array.isArray(r.entries) ? r.entries : [];
      const entries: { datetime: string; label?: string }[] = [];
      for (const e of raw) {
        if (!e || typeof e !== "object") continue;
        const er = e as Record<string, unknown>;
        const datetime = clean(er.datetime, 60);
        if (!Number.isFinite(Date.parse(datetime))) continue;
        const label = clean(er.label, 120) || undefined;
        entries.push(label ? { datetime, label } : { datetime });
        if (entries.length >= 12) break;
      }
      if (entries.length === 0) return null;
      return { type, ...b, entries };
    }
    case "range": {
      const validUnits = ["time", "weekday", "month", "year", "date", "place", "amount", "generic"];
      const unit = (validUnits as readonly string[]).includes(r.unit as string)
        ? (r.unit as "time" | "weekday" | "month" | "year" | "date" | "place" | "amount" | "generic")
        : "generic";
      const from = clean(r.from, 120);
      const to = clean(r.to, 120);
      if (!from || !to) return null;
      return { type, ...b, unit, from, to };
    }
    case "crew": {
      const raw = Array.isArray(r.roles) ? r.roles : [];
      const roles: { name: string }[] = [];
      for (const x of raw) {
        if (!x) continue;
        const name = typeof x === "string" ? clean(x, 60) : clean((x as { name?: unknown }).name, 60);
        if (name) roles.push({ name });
        if (roles.length >= 12) break;
      }
      if (roles.length === 0) return null;
      return { type, ...b, roles };
    }
    case "work_packages": {
      const raw = Array.isArray(r.packages) ? r.packages : [];
      const packages: { label: string; description?: string }[] = [];
      for (const x of raw) {
        if (!x || typeof x !== "object") continue;
        const xr = x as Record<string, unknown>;
        const label = clean(xr.label, 120);
        if (!label) continue;
        const description = clean(xr.description, 240) || undefined;
        packages.push(description ? { label, description } : { label });
        if (packages.length >= 12) break;
      }
      if (packages.length === 0) return null;
      return { type, ...b, packages };
    }
    case "deliverables": {
      const raw = Array.isArray(r.items) ? r.items : [];
      const items: {
        label: string;
        details?: string;
        quantity?: string;
        format?: string;
        due?: string;
        status?: "planned" | "in_progress" | "ready" | "delivered";
      }[] = [];
      for (const x of raw) {
        if (!x || typeof x !== "object") continue;
        const xr = x as Record<string, unknown>;
        const label = clean(xr.label, 120);
        if (!label) continue;
        const details = clean(xr.details, 240) || undefined;
        const quantity = clean(xr.quantity, 60) || undefined;
        const format = clean(xr.format, 80) || undefined;
        const due = clean(xr.due, 80) || undefined;
        const status =
          typeof xr.status === "string" && DELIVERABLE_STATUSES.has(xr.status)
            ? (xr.status as "planned" | "in_progress" | "ready" | "delivered")
            : undefined;
        items.push({
          label,
          ...(details ? { details } : {}),
          ...(quantity ? { quantity } : {}),
          ...(format ? { format } : {}),
          ...(due ? { due } : {}),
          ...(status ? { status } : {}),
        });
        if (items.length >= 16) break;
      }
      if (items.length === 0) return null;
      return { type, ...b, items };
    }
    case "approvals": {
      const raw = Array.isArray(r.items) ? r.items : [];
      const items: {
        text: string;
        description?: string;
        due?: string;
        audience?: "client" | "internal";
        status?: "pending" | "requested" | "approved";
      }[] = [];
      for (const x of raw) {
        if (!x) continue;
        if (typeof x === "string") {
          const text = clean(x, 200);
          if (text) items.push({ text });
        } else if (typeof x === "object") {
          const xr = x as Record<string, unknown>;
          const text = clean(xr.text, 200);
          if (!text) continue;
          const description = clean(xr.description, 240) || undefined;
          const due = clean(xr.due, 80) || undefined;
          const audience =
            typeof xr.audience === "string" && APPROVAL_AUDIENCES.has(xr.audience)
              ? (xr.audience as "client" | "internal")
              : undefined;
          const status =
            typeof xr.status === "string" && APPROVAL_STATUSES.has(xr.status)
              ? (xr.status as "pending" | "requested" | "approved")
              : undefined;
          items.push({
            text,
            ...(description ? { description } : {}),
            ...(due ? { due } : {}),
            ...(audience ? { audience } : {}),
            ...(status ? { status } : {}),
          });
        }
        if (items.length >= 16) break;
      }
      if (items.length === 0) return null;
      return { type, ...b, items };
    }
    case "notes": {
      const placeholder = clean(r.placeholder, 200) || undefined;
      return { type, ...b, placeholder };
    }
    case "qa": {
      const placeholder = clean(r.placeholder, 200) || undefined;
      const raw = Array.isArray(r.questions) ? r.questions : [];
      const questions: { text: string; answerHint?: string }[] = [];
      for (const x of raw) {
        if (!x) continue;
        if (typeof x === "string") {
          const text = clean(x, 200);
          if (text) questions.push({ text });
        } else if (typeof x === "object") {
          const xr = x as Record<string, unknown>;
          const text = clean(xr.text, 200);
          if (!text) continue;
          const answerHint = clean(xr.answerHint, 120) || undefined;
          questions.push(answerHint ? { text, answerHint } : { text });
        }
        if (questions.length >= 12) break;
      }
      return { type, ...b, placeholder, ...(questions.length > 0 ? { questions } : {}) };
    }
    case "poll": {
      const question = clean(r.question, 200);
      const options = stringArray(r.options, 6, 80);
      return { type, ...b, question, options };
    }
    case "discussion": {
      const placeholder = clean(r.placeholder, 200) || undefined;
      return { type, ...b, placeholder };
    }
    case "phases": {
      const raw = Array.isArray(r.phases) ? r.phases : [];
      const phases: { label: string; description?: string }[] = [];
      for (const x of raw) {
        if (!x) continue;
        if (typeof x === "string") {
          const label = clean(x, 60);
          if (label) phases.push({ label });
        } else if (typeof x === "object") {
          const xr = x as Record<string, unknown>;
          const label = clean(xr.label, 60);
          if (label) {
            const description = clean(xr.description, 200) || undefined;
            phases.push(description ? { label, description } : { label });
          }
        }
        if (phases.length >= 10) break;
      }
      if (phases.length < 2) return null;
      const currentPhase = num(r.currentPhase, 0, 0, phases.length - 1);
      return { type, ...b, phases, currentPhase };
    }
    case "checklist": {
      const raw = Array.isArray(r.items) ? r.items : [];
      const items: { text: string }[] = [];
      for (const x of raw) {
        if (!x) continue;
        if (typeof x === "string") {
          const text = clean(x, 200);
          if (text) items.push({ text });
        } else if (typeof x === "object") {
          const text = clean((x as { text?: unknown }).text, 200);
          if (text) items.push({ text });
        }
        if (items.length >= 24) break;
      }
      return { type, ...b, items };
    }
    case "attachments": {
      const placeholder = clean(r.placeholder, 200) || undefined;
      return { type, ...b, placeholder };
    }
    case "images": {
      const placeholder = clean(r.placeholder, 200) || undefined;
      return { type, ...b, placeholder };
    }
    case "moodboard": {
      const placeholder = clean(r.placeholder, 200) || undefined;
      const raw = Array.isArray(r.directions) ? r.directions : [];
      const directions: {
        label: string;
        note?: string;
        status?: "reference" | "approved" | "avoid";
      }[] = [];
      for (const x of raw) {
        if (!x || typeof x !== "object") continue;
        const xr = x as Record<string, unknown>;
        const label = clean(xr.label, 120);
        if (!label) continue;
        const note = clean(xr.note, 240) || undefined;
        const status =
          typeof xr.status === "string" && MOODBOARD_DIRECTION_STATUSES.has(xr.status)
            ? (xr.status as "reference" | "approved" | "avoid")
            : undefined;
        directions.push({
          label,
          ...(note ? { note } : {}),
          ...(status ? { status } : {}),
        });
        if (directions.length >= 12) break;
      }
      return { type, ...b, placeholder, directions };
    }
    case "selection": {
      const placeholder = clean(r.placeholder, 200) || undefined;
      return { type, ...b, placeholder };
    }
    case "audio": {
      const placeholder = clean(r.placeholder, 200) || undefined;
      return { type, ...b, placeholder };
    }
    case "sketch": {
      const placeholder = clean(r.placeholder, 200) || undefined;
      return { type, ...b, placeholder };
    }
    case "table": {
      const columns = stringArray(r.columns, 8, 40);
      if (columns.length === 0) return null;
      const rowsRaw = Array.isArray(r.rows) ? r.rows : [];
      const rows: string[][] = [];
      for (const row of rowsRaw) {
        if (!Array.isArray(row)) continue;
        const cells: string[] = [];
        for (let i = 0; i < columns.length; i++) {
          cells.push(clean(row[i], 200));
        }
        rows.push(cells);
        if (rows.length >= 24) break;
      }
      return { type, ...b, columns, rows };
    }
    case "shot_list": {
      const raw = Array.isArray(r.shots) ? r.shots : [];
      const shots: {
        label: string;
        purpose?: string;
        setup?: string;
        location?: string;
        notes?: string;
        priority?: "must" | "should" | "nice";
        status?: "planned" | "captured" | "selected";
      }[] = [];
      for (const x of raw) {
        if (!x || typeof x !== "object") continue;
        const xr = x as Record<string, unknown>;
        const label = clean(xr.label, 140);
        if (!label) continue;
        const purpose = clean(xr.purpose, 160) || undefined;
        const setup = clean(xr.setup, 160) || undefined;
        const location = clean(xr.location, 120) || undefined;
        const notes = clean(xr.notes, 220) || undefined;
        const priority =
          typeof xr.priority === "string" && SHOT_PRIORITIES.has(xr.priority)
            ? (xr.priority as "must" | "should" | "nice")
            : undefined;
        const status =
          typeof xr.status === "string" && SHOT_STATUSES.has(xr.status)
            ? (xr.status as "planned" | "captured" | "selected")
            : undefined;
        shots.push({
          label,
          ...(purpose ? { purpose } : {}),
          ...(setup ? { setup } : {}),
          ...(location ? { location } : {}),
          ...(notes ? { notes } : {}),
          ...(priority ? { priority } : {}),
          ...(status ? { status } : {}),
        });
        if (shots.length >= 40) break;
      }
      return { type, ...b, shots };
    }
    case "parts_list": {
      const raw = Array.isArray(r.items) ? r.items : [];
      const items: { name: string; quantity?: string; imageUrl?: string }[] = [];
      for (const x of raw) {
        if (!x || typeof x !== "object") continue;
        const xr = x as Record<string, unknown>;
        const name = clean(xr.name, 120);
        if (!name) continue;
        const quantity = clean(xr.quantity, 40) || undefined;
        const imageUrl = clean(xr.imageUrl, 500);
        const validImg = imageUrl && /^https?:\/\/[^\s]+$/i.test(imageUrl)
          ? imageUrl
          : undefined;
        const entry: { name: string; quantity?: string; imageUrl?: string } = { name };
        if (quantity) entry.quantity = quantity;
        if (validImg) entry.imageUrl = validImg;
        items.push(entry);
        if (items.length >= 30) break;
      }
      return { type, ...b, items };
    }
    case "gif": {
      const gifUrl = clean(r.gifUrl, 500);
      if (!/^https?:\/\/[^\s]+$/i.test(gifUrl)) return null;
      const thumbnailUrl = clean(r.thumbnailUrl, 500);
      const validThumb = thumbnailUrl && /^https?:\/\/[^\s]+$/i.test(thumbnailUrl)
        ? thumbnailUrl
        : undefined;
      return { type, ...b, gifUrl, thumbnailUrl: validThumb };
    }
  }
}

/** Sanitize a list of module candidates. Drops invalid ones, caps the
 *  list to a sane upper bound so the UI never tries to render a 200-
 *  widget space. */
export function sanitizeModules(raw: unknown): Module[] {
  if (!Array.isArray(raw)) return [];
  const out: Module[] = [];
  for (const item of raw) {
    const m = sanitizeModule(item);
    if (m) out.push(m);
    if (out.length >= 32) break;
  }
  return out;
}

// ============================================================
// MODULE_META — agent-facing semantics for every widget type
//
// The classifier prompt is constructed from this table at runtime so
// it stays in lockstep with the registry. Adding another widget means
// extending types + sanitizer + this table; the prompt picks the new
// entry up automatically.
// ============================================================

export type ExternalSource =
  | "wikipedia"
  | "iconify"
  | "map"
  | "intl"
  | "graphics"
  | "gif"
  | "storage"
  | null;

export interface ModuleMeta {
  /** Whether this widget always lives in the header zone (above the
   *  grid). Header zone widgets are always inserted. */
  partOfHeader: boolean;
  /** Whether the widget is always inserted (true for the three header
   *  widgets) or conditional. */
  alwaysInserted: boolean;
  /** When the agent should pick this widget — the rule the classifier
   *  prompt uses. Written in the user's language is irrelevant here;
   *  this is internal prompt scaffolding. */
  relevantWhen: string;
  /** Whether the agent must collect specific data from the user during
   *  the clarify step before the page can be assembled. */
  requiresMandatoryConfig: boolean;
  /** External data source the renderer fetches from at view time, if
   *  any. */
  externalSource: ExternalSource;
  /** Whether the source mandates a visible attribution row. */
  requiresAttribution: boolean;
  /** Whether collaborators can vote / signal on parts of the widget. */
  hasSignals: boolean;
  /** Whether the widget receives file uploads. */
  hasUploads: boolean;
  /** Whether the widget hosts threaded text contributions. */
  hasThread: boolean;
}

export const MODULE_META: Record<ModuleType, ModuleMeta> = {
  // Header zone — always inserted
  heading: {
    partOfHeader: true,
    alwaysInserted: true,
    relevantWhen: "always — the space title",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  rich_text: {
    partOfHeader: true,
    alwaysInserted: true,
    relevantWhen: "always — short context paragraph below the title",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  tags: {
    partOfHeader: true,
    alwaysInserted: true,
    relevantWhen: "always — surface themes/keywords",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },

  // Wiki / AI reference
  wikipedia: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "input names (a) an established method/practice with a Wikipedia article (OKR, Pomodoro, Postmortem, …), (b) a named cultural/social form (Repair-Café, Buchclub, Open Mic, …), (c) a named field or person (Permaculture, Bayesian Inference, Camus, …), or (d) a place with a substantive Wikipedia entry. NEVER for generic activities, personal situations, creative/subjective topics, areas where the user is clearly the expert, or anything Wikipedia would treat generically. Maximum one per space.",
    requiresMandatoryConfig: false,
    externalSource: "wikipedia",
    requiresAttribution: true,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  ai_summary: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "input would benefit from a generalised, abstract take that makes the matter more graspable. Use sparingly; max one per space.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },

  // Icon
  icon: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "a symbol would aid recognition. Skip for projects about art or branding where a generic icon would clash with the user's own visual identity.",
    requiresMandatoryConfig: false,
    externalSource: "iconify",
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },

  // Map family — all four are mandatory-config
  location_single: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen: "input concerns one specific location.",
    requiresMandatoryConfig: true,
    externalSource: "map",
    requiresAttribution: true,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  locations_multi: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen: "input concerns multiple confirmed locations.",
    requiresMandatoryConfig: true,
    externalSource: "map",
    requiresAttribution: true,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  location_suggestions: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "input mentions a location need but the actual place must still be agreed on by participants. Renders as a text list with vote stacking, not a map.",
    requiresMandatoryConfig: true,
    externalSource: "map",
    requiresAttribution: true,
    hasSignals: true,
    hasUploads: false,
    hasThread: false,
  },
  route: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen: "input concerns a route between multiple stops.",
    requiresMandatoryConfig: true,
    externalSource: "map",
    requiresAttribution: true,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },

  // Time
  date: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen: "input mentions a specific day without a specific time.",
    requiresMandatoryConfig: false,
    externalSource: "intl",
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  appointment: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen: "input mentions a specific day AND time.",
    requiresMandatoryConfig: false,
    externalSource: "intl",
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  appointments: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen: "input mentions multiple specific days/times.",
    requiresMandatoryConfig: false,
    externalSource: "intl",
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  range: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "input mentions a span — from-X-to-Y of times, weekdays, months, years, dates, places or quantities.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },

  // Team / packages
  crew: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "a team should form with members taking on different roles. Each role is claimable; the widget supports a segment-share invite per role.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: true,
    hasUploads: false,
    hasThread: false,
  },
  work_packages: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "recording the relevant work packages would help. Each package is claimable; the widget supports a segment-share invite per package.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: true,
    hasUploads: false,
    hasThread: false,
  },
  deliverables: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "the concrete outputs, formats, counts, delivery expectations, or ownership/status of outcomes should be made explicit.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: true,
    hasUploads: false,
    hasThread: false,
  },
  approvals: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "the work needs explicit sign-off checkpoints or named approvals before moving ahead.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: true,
    hasUploads: false,
    hasThread: false,
  },

  // Free-form
  notes: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "the work will genuinely accrue scratch observations worth keeping over time — research, fieldwork, iterative exploration. NOT a default; skip for simple, one-off, or self-contained matters.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  qa: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "there are genuine open questions the group must answer together before proceeding — concrete unknowns, not vague 'might have questions'.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: true,
  },
  poll: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "parts or details are up for debate and should be evaluated together.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: true,
    hasUploads: false,
    hasThread: false,
  },
  discussion: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "mostly fitting — enables ongoing chat about the matter with chronological traceability.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: true,
  },

  // Visualisation
  phases: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "a chronological representation makes the matter easier to understand.",
    requiresMandatoryConfig: true,
    externalSource: "graphics",
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  checklist: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "it makes sense to publicly tick off things to do. Renders the checker's avatar in the checked box.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: true,
    hasUploads: false,
    hasThread: false,
  },

  // Uploads
  attachments: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "files (up to 5MB each) are relevant for working on the matter.",
    requiresMandatoryConfig: false,
    externalSource: "storage",
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: true,
    hasThread: false,
  },
  images: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "visible images (up to 5MB each) are relevant. Renders as an auto-scrolling gallery.",
    requiresMandatoryConfig: false,
    externalSource: "storage",
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: true,
    hasThread: false,
  },
  moodboard: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "a visual direction needs shared reference images, style cues, lighting notes, colour/mood, poses, styling direction, or explicit no-gos. Best for photo/video/creative projects.",
    requiresMandatoryConfig: false,
    externalSource: "storage",
    requiresAttribution: false,
    hasSignals: true,
    hasUploads: true,
    hasThread: false,
  },
  selection: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "the photographer provides a set of photos for a client to review, select/favourite, and comment on (post-shoot proofing). Added in the selection stage, not at briefing.",
    requiresMandatoryConfig: false,
    externalSource: "storage",
    requiresAttribution: false,
    hasSignals: true,
    hasUploads: true,
    hasThread: true,
  },
  audio: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "audio (up to 5MB per file) is relevant.",
    requiresMandatoryConfig: false,
    externalSource: "storage",
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: true,
    hasThread: false,
  },

  // Specialty
  sketch: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "the matter is creative or playful and benefits from a canvas. Strokes are coloured by author profile.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  table: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "multiple items share common attributes and should be made comparable.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  shot_list: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "a photo/video production needs a concrete capture list with shots, purpose, setup, location, priority, notes, or capture status. Prefer this over a generic table for shoots.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: true,
    hasUploads: false,
    hasThread: false,
  },
  parts_list: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "a collection of required parts / supplies / BOM should be kept.",
    requiresMandatoryConfig: false,
    externalSource: null,
    requiresAttribution: false,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
  gif: {
    partOfHeader: false,
    alwaysInserted: false,
    relevantWhen:
      "the matter is creative and exploratory — a GIF as decorative anchor. Skip for serious / formal contexts.",
    requiresMandatoryConfig: false,
    externalSource: "gif",
    requiresAttribution: true,
    hasSignals: false,
    hasUploads: false,
    hasThread: false,
  },
};

// ============================================================
// Convenience selectors used by the classifier + clarify endpoint
// ============================================================

export function mandatoryConfigTypes(): ModuleType[] {
  return ALL_MODULE_TYPES.filter((t) => MODULE_META[t].requiresMandatoryConfig);
}

export function alwaysInsertedTypes(): ModuleType[] {
  return ALL_MODULE_TYPES.filter((t) => MODULE_META[t].alwaysInserted);
}

export function bodyTypes(): ModuleType[] {
  return ALL_MODULE_TYPES.filter((t) => !MODULE_META[t].partOfHeader);
}
