/**
 * DATA CONTRACT — the stable interface of a magyc.site space.
 *
 * This file is the single source of truth for the shapes that any
 * external consumer (the future MCP bridge, an export, an import) binds
 * to. The presentation layer (renderers, animations, the style system)
 * can change freely without touching this contract. The DATA shapes
 * below should change only deliberately — and when they do, bump
 * CONTRACT_VERSION and update docs/DATA_CONTRACT.md.
 *
 * Two guard arrays mirror the live registries (ALL_MODULE_TYPES and the
 * ModuleStateKind union). The assertions at the bottom fail to compile
 * if the live registry drifts from this frozen list — so any addition
 * or removal of a widget type / state kind forces a conscious update
 * here, which is exactly the friction we want before MCP exists.
 */

import type { ModuleStateKind, ModuleType } from "./types";

/** Bump on any breaking change to a module data shape, the state
 *  vocabulary, or the space shape. Minor (additive, back-compatible)
 *  changes bump the minor; breaking changes bump the major. */
export const CONTRACT_VERSION = "1.6.0";

/**
 * The frozen set of widget types. Order is the canonical order.
 * If you add another widget, add it here AND bump CONTRACT_VERSION.
 */
export const CONTRACT_MODULE_TYPES = [
  // Header zone (always present)
  "heading", "rich_text", "tags",
  // Reference / framing
  "wikipedia", "ai_summary", "icon",
  // Place
  "location_single", "locations_multi", "location_suggestions", "route",
  // Time
  "date", "appointment", "appointments", "range",
  // Team / work
  "crew", "work_packages", "deliverables",
  // Collaboration
  "notes", "qa", "poll", "discussion", "approvals",
  // Visualisation
  "phases", "checklist",
  // Uploads
  "attachments", "images", "moodboard", "selection", "audio",
  // Specialty
  "sketch", "table", "shot_list", "parts_list", "gif",
] as const satisfies readonly ModuleType[];

/**
 * The frozen collaborative-action vocabulary. Each kind's `data` blob
 * shape is documented in docs/DATA_CONTRACT.md.
 */
export const CONTRACT_STATE_KINDS = [
  "vote",   // poll / location_suggestions — data: { option }
  "check",  // checklist — data: { itemKey, checked }
  "claim",  // crew / work_packages — data: { slotLabel, claimed? }
  "voice",  // qa / discussion — data: { id, text, role?, parentId? }
  "edit",   // notes / table cells — data: { id?, text?, ... }
  "add",    // notes / checklist / parts_list — data: free per widget
  "upload", // attachments / images / audio — data: { url, name, size?, mimeType? }
  "stroke", // sketch — data: { path, color?, width? }
] as const satisfies readonly ModuleStateKind[];

// ── Compile-time drift guards ─────────────────────────────────────────
// `satisfies readonly ModuleType[]` above already guarantees the
// contract lists only REAL types. These two checks guarantee the
// reverse — that EVERY live ModuleType / ModuleStateKind is covered by
// the contract. If a new widget type or state kind is added to the
// union without being listed here, the corresponding line stops
// compiling, forcing a deliberate contract update + version bump.

type _MissingModuleType = Exclude<ModuleType, typeof CONTRACT_MODULE_TYPES[number]>;
export const _allModuleTypesContracted: _MissingModuleType extends never
  ? true
  : ["CONTRACT DRIFT: a ModuleType is missing from CONTRACT_MODULE_TYPES — add it + bump CONTRACT_VERSION"] = true;

type _MissingStateKind = Exclude<ModuleStateKind, typeof CONTRACT_STATE_KINDS[number]>;
export const _allStateKindsContracted: _MissingStateKind extends never
  ? true
  : ["CONTRACT DRIFT: a ModuleStateKind is missing from CONTRACT_STATE_KINDS — add it + bump CONTRACT_VERSION"] = true;

/** Runtime helper: is this a known, contracted widget type? */
export function isContractedType(t: string): t is ModuleType {
  return (CONTRACT_MODULE_TYPES as readonly string[]).includes(t);
}
