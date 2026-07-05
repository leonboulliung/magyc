/**
 * Account-level Studio profile + settings. Persisted on the `profiles` row
 * (see migration 014). The profile is the photographer's public-facing
 * identity; settings are private account preferences, including the global
 * "rules" that get woven into every new project's brief.
 */

/** A reusable click-to-insert snippet, optionally tinted for quick scanning. */
export interface FastPrompt {
  text: string;
  /** Optional accent hex (#rrggbb) from FAST_PROMPT_COLORS, or undefined. */
  color?: string;
}

/** The optional tint palette offered in the Schnellbausteine editor. */
export const FAST_PROMPT_COLORS = [
  "#17171a", "#6b7280", "#8b7bff", "#39d2b4",
] as const;

export interface StudioSettings {
  /** Working-style rules applied to every new project (prompt injections). */
  rules: string[];
  /** Reusable snippets the photographer can click to drop into the prompt
   *  field (e.g. a frequent shoot address). Free-form, account-configured. */
  fastPrompts: FastPrompt[];
  /** Default language for new projects. */
  defaultLanguage: string;
  /** New projects start shared (link-accessible) instead of private. */
  defaultShared: boolean;
  /** Canvas theme for the photographer's project pages (the "stage"). The
   *  per-space accent stays; only the canvas/ink flip. Applies to owner + the
   *  clients viewing the shared link, so a project looks consistent. */
  projectTheme: "dark" | "light";
  /** Legal identity used on contracts (Dienstleister-Daten). */
  business: StudioBusiness;
  /** Reusable contract conditions — the photographer's "contract DNA",
   *  filled once and woven into every contract draft. */
  conditions: StudioConditions;
}

export interface StudioProfile {
  displayName: string;
  headline: string;
  bio: string;
  specialties: string[];
  settings: StudioSettings;
  /** Read-only, snapshotted from Clerk. */
  avatarUrl: string | null;
  color: string | null;
}

export const LANGUAGE_OPTIONS = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "nl", label: "Nederlands" },
  { value: "pt", label: "Português" },
] as const;

// ── Conditions — the photographer's reusable contract "DNA" ──────────────
// See docs/CONTRACT_FIELDS_SPEC.md. Persisted in settings.business +
// settings.conditions (no migration; the settings jsonb already exists). This
// is the lean MVP subset; the full spec adds more fields later.

export interface StudioBusiness {
  legalName: string;
  address: string;
  vatId: string;
  taxNumber: string;
  phone: string;
  email: string;
}

export type DeliveryFormat = "Digitaler Download" | "Online-Galerie" | "Print" | "USB-Stick" | "Fotobuch";
export const DELIVERY_FORMATS: readonly DeliveryFormat[] = [
  "Digitaler Download", "Online-Galerie", "Print", "USB-Stick", "Fotobuch",
];

export type EditLevel = "basic" | "standard" | "advanced";
export const EDIT_LEVELS: { value: EditLevel; label: string }[] = [
  { value: "basic", label: "Auswahl" },
  { value: "standard", label: "Standard" },
  { value: "advanced", label: "Retusche" },
];

export type LicenseScope = "private" | "commercial" | "editorial" | "unlimited";
export const LICENSE_SCOPES: { value: LicenseScope; label: string }[] = [
  { value: "private", label: "Privat" },
  { value: "commercial", label: "Kommerziell" },
  { value: "editorial", label: "Redaktionell" },
  { value: "unlimited", label: "Unbegrenzt" },
];

export type LicenseDuration = "unbefristet" | "1J" | "2J" | "5J";
export const LICENSE_DURATIONS: { value: LicenseDuration; label: string }[] = [
  { value: "unbefristet", label: "Unbefristet" },
  { value: "1J", label: "1 Jahr" },
  { value: "2J", label: "2 Jahre" },
  { value: "5J", label: "5 Jahre" },
];

export interface CancellationTier {
  untilDaysBefore: number;
  percent: number;
}

export interface StudioConditions {
  service: { description: string };
  deliverables: { formats: DeliveryFormat[]; editLevel: EditLevel; turnaround: string };
  license: { scope: LicenseScope; duration: LicenseDuration; creditRequired: boolean };
  payment: { depositPercent: number; paymentTermDays: number; kleinunternehmer19: boolean; vatRate: 19 | 7 };
  cancellation: { tiers: CancellationTier[]; photographerCancelClause: string; forceMajeureClause: string };
  privacy: { dataProtectionClause: string; retention: string };
  legal: { agbRef: string; jurisdiction: string };
}

export const DEFAULT_BUSINESS: StudioBusiness = {
  legalName: "", address: "", vatId: "", taxNumber: "", phone: "", email: "",
};

export const DEFAULT_CONDITIONS: StudioConditions = {
  service: { description: "" },
  deliverables: { formats: ["Digitaler Download"], editLevel: "standard", turnaround: "4 Wochen" },
  license: { scope: "private", duration: "unbefristet", creditRequired: true },
  payment: { depositPercent: 30, paymentTermDays: 14, kleinunternehmer19: false, vatRate: 19 },
  cancellation: {
    tiers: [
      { untilDaysBefore: 30, percent: 50 },
      { untilDaysBefore: 7, percent: 80 },
      { untilDaysBefore: 0, percent: 100 },
    ],
    photographerCancelClause:
      "Bei Ausfall durch die Fotograf:in wird ein Ersatztermin angeboten oder die Anzahlung vollständig zurückerstattet.",
    forceMajeureClause:
      "Bei höherer Gewalt (z. B. Krankheit, Unwetter) wird ein Ersatztermin vereinbart; bereits geleistete Anzahlungen werden angerechnet.",
  },
  privacy: {
    dataProtectionClause:
      "Personenbezogene Daten werden ausschließlich zur Vertragsabwicklung gemäß DSGVO verarbeitet und nicht ohne Einwilligung an Dritte weitergegeben.",
    retention: "12 Monate",
  },
  legal: { agbRef: "", jurisdiction: "Es gilt das Recht der Bundesrepublik Deutschland." },
};

function asStr(v: unknown, max: number, def = ""): string {
  return typeof v === "string" ? v.slice(0, max) : def;
}
function asNum(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}
function asBool(v: unknown, def: boolean): boolean {
  return typeof v === "boolean" ? v : def;
}
function asEnum<T extends string>(v: unknown, allowed: readonly T[], def: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : def;
}

export function cleanBusiness(raw: unknown): StudioBusiness {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    legalName: asStr(o.legalName, 120),
    address: asStr(o.address, 400),
    vatId: asStr(o.vatId, 40),
    taxNumber: asStr(o.taxNumber, 40),
    phone: asStr(o.phone, 40),
    email: asStr(o.email, 120),
  };
}

export function cleanConditions(raw: unknown): StudioConditions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const get = (k: string) => (o[k] && typeof o[k] === "object" ? (o[k] as Record<string, unknown>) : {});
  const d = DEFAULT_CONDITIONS;
  const service = get("service");
  const deliverables = get("deliverables");
  const license = get("license");
  const payment = get("payment");
  const cancellation = get("cancellation");
  const privacy = get("privacy");
  const legal = get("legal");

  const formats = Array.isArray(deliverables.formats)
    ? (deliverables.formats.filter((f): f is DeliveryFormat => DELIVERY_FORMATS.includes(f as DeliveryFormat)))
    : d.deliverables.formats;

  const tiers = Array.isArray(cancellation.tiers)
    ? cancellation.tiers
        .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
        .map((t) => ({ untilDaysBefore: asNum(t.untilDaysBefore, 0, 3650, 0), percent: asNum(t.percent, 0, 100, 0) }))
        .slice(0, 6)
    : d.cancellation.tiers;

  return {
    service: { description: asStr(service.description, 1000) },
    deliverables: {
      formats: formats.length ? formats : d.deliverables.formats,
      editLevel: asEnum(deliverables.editLevel, ["basic", "standard", "advanced"], "standard"),
      turnaround: asStr(deliverables.turnaround, 80, d.deliverables.turnaround),
    },
    license: {
      scope: asEnum(license.scope, ["private", "commercial", "editorial", "unlimited"], "private"),
      duration: asEnum(license.duration, ["unbefristet", "1J", "2J", "5J"], "unbefristet"),
      creditRequired: asBool(license.creditRequired, true),
    },
    payment: {
      depositPercent: asNum(payment.depositPercent, 0, 100, 30),
      paymentTermDays: asNum(payment.paymentTermDays, 0, 365, 14),
      kleinunternehmer19: asBool(payment.kleinunternehmer19, false),
      vatRate: payment.vatRate === 7 ? 7 : 19,
    },
    cancellation: {
      tiers: tiers.length ? tiers : d.cancellation.tiers,
      photographerCancelClause: asStr(cancellation.photographerCancelClause, 1000, d.cancellation.photographerCancelClause),
      forceMajeureClause: asStr(cancellation.forceMajeureClause, 1000, d.cancellation.forceMajeureClause),
    },
    privacy: {
      dataProtectionClause: asStr(privacy.dataProtectionClause, 2000, d.privacy.dataProtectionClause),
      retention: asStr(privacy.retention, 80, d.privacy.retention),
    },
    legal: {
      agbRef: asStr(legal.agbRef, 300),
      jurisdiction: asStr(legal.jurisdiction, 300, d.legal.jurisdiction),
    },
  };
}

export const DEFAULT_SETTINGS: StudioSettings = {
  rules: [],
  fastPrompts: [],
  defaultLanguage: "de",
  defaultShared: false,
  projectTheme: "light",
  business: DEFAULT_BUSINESS,
  conditions: DEFAULT_CONDITIONS,
};

function asStringArray(value: unknown, max = 24): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Parse fast-prompts. Accepts legacy plain strings AND the {text,color} shape
 *  so old accounts keep working after the colour upgrade. */
export function cleanFastPrompts(value: unknown): FastPrompt[] {
  if (!Array.isArray(value)) return [];
  const palette = new Set<string>(FAST_PROMPT_COLORS);
  const out: FastPrompt[] = [];
  for (const item of value) {
    let text = "";
    let color: string | undefined;
    if (typeof item === "string") {
      text = item.trim();
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      text = typeof o.text === "string" ? o.text.trim() : "";
      if (typeof o.color === "string" && palette.has(o.color)) color = o.color;
    }
    if (!text) continue;
    out.push(color ? { text: text.slice(0, 200), color } : { text: text.slice(0, 200) });
    if (out.length >= 20) break;
  }
  return out;
}

export function cleanSettings(raw: unknown): StudioSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lang = typeof o.defaultLanguage === "string" ? o.defaultLanguage : DEFAULT_SETTINGS.defaultLanguage;
  return {
    rules: asStringArray(o.rules, 12),
    fastPrompts: cleanFastPrompts(o.fastPrompts),
    defaultLanguage: LANGUAGE_OPTIONS.some((l) => l.value === lang) ? lang : DEFAULT_SETTINGS.defaultLanguage,
    defaultShared: o.defaultShared === true,
    projectTheme: o.projectTheme === "dark" ? "dark" : "light",
    business: cleanBusiness(o.business),
    conditions: cleanConditions(o.conditions),
  };
}

export function cleanProfile(raw: unknown): StudioProfile {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    displayName: typeof o.displayName === "string" ? o.displayName.slice(0, 80) : "",
    headline: typeof o.headline === "string" ? o.headline.slice(0, 120) : "",
    bio: typeof o.bio === "string" ? o.bio.slice(0, 600) : "",
    specialties: asStringArray(o.specialties),
    settings: cleanSettings(o.settings),
    avatarUrl: typeof o.avatarUrl === "string" ? o.avatarUrl : null,
    color: typeof o.color === "string" ? o.color : null,
  };
}
