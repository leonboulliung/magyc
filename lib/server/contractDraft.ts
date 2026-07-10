import "server-only";
import OpenAI from "openai";
import type { Module } from "@/lib/types";
import { buildProjectFacts, type ProjectFacts } from "@/lib/projectFacts";
import {
  type StudioConditions,
  type StudioBusiness,
  LICENSE_SCOPES,
  LICENSE_DURATIONS,
  EDIT_LEVELS,
} from "@/lib/studioProfile";
import type {
  ContractDraft,
  ContractSection,
  ContractClause,
  ContractParties,
  ClauseSource,
} from "@/lib/contractDraft";
import { normalizeLocale, type Locale } from "@/lib/i18n/locale";

/**
 * The agentic contract drafter. Turns {studio conditions + business} +
 * {project modules} + {parties} into a structured, REVIEWABLE ContractDraft.
 *
 * Determinism guard: prices, dates, counts, names and legal clause texts are
 * taken verbatim from the inputs — the LLM only writes the connective
 * "Leistungsbeschreibung" prose from the extracted facts (and never invents
 * numbers). Everything else is assembled deterministically server-side.
 * See docs/CONTRACT_FIELDS_SPEC.md §3.
 */

const MODEL = "gpt-4o-mini";

const CONTRACT_COPY = {
  de: {
    due: "fällig",
    more: "weitere",
    setup: "Setup",
    location: "Ort",
    untilDaysBefore: "bis {days} Tage vorher: {percent}%",
    serviceProvider: "Dienstleister",
    studio: "Studio",
    contact: "Ansprechpartner:in",
    address: "Anschrift",
    businessAddressMissing: "Geschäftsanschrift fehlt — in den Einstellungen ergänzen.",
    tax: "Steuer",
    smallBusiness: "Kleinunternehmer gem. §19 UStG — keine USt. ausgewiesen.",
    client: "Kunde",
    name: "Name",
    clientNameMissing: "Kundenname fehlt — wird bei der Freigabe ergänzt.",
    clientEmailMissing: "E-Mail des Kunden fehlt.",
    company: "Firma",
    projectDetails: "Projekt-Einzelheiten",
    project: "Projekt",
    projectFallback: "Projekt",
    contractFallback: "Vertrag",
    serviceDescription: "Leistungsbeschreibung",
    dates: "Termin(e)",
    datesMissing: "Kein Shooting-Termin im Plan — bitte ergänzen.",
    places: "Ort(e)",
    servicesDelivery: "Leistungen & Lieferung",
    formats: "Formate",
    editing: "Bearbeitung",
    turnaround: "Lieferfrist",
    crew: "Beteiligte",
    visualDirection: "Visuelle Richtung",
    approvals: "Freigaben",
    approved: "freigegeben",
    preparation: "Vorbereitung",
    done: "erledigt",
    referencesAttachments: "Referenzen & Anhänge",
    files: "Dateien",
    selected: "ausgewählt",
    parts: "Utensilien / Technik",
    conditions: "Konditionen",
    license: "Nutzungsrechte",
    credit: "mit Urhebernennung",
    fee: "Honorar",
    feeMissing: "Honorar fehlt — bitte Betrag ergänzen.",
    payment: "Zahlungsbedingungen",
    deposit: "Anzahlung",
    paymentTerm: "Zahlungsziel",
    days: "Tage",
    vatAdd: "zzgl.",
    vat: "MwSt.",
    cancellation: "Stornostaffel",
    photographerCancel: "Ausfall durch Fotograf:in",
    forceMajeure: "Höhere Gewalt",
    miscellaneous: "Sonstiges",
    terms: "AGB",
    privacy: "Datenschutz",
    retention: "Aufbewahrung",
    jurisdiction: "Gerichtsstand / Recht",
  },
  en: {
    due: "due",
    more: "more",
    setup: "Setup",
    location: "Location",
    untilDaysBefore: "up to {days} days before: {percent}%",
    serviceProvider: "Service provider",
    studio: "Studio",
    contact: "Contact",
    address: "Address",
    businessAddressMissing: "Business address is missing — add it in settings.",
    tax: "Tax",
    smallBusiness: "Small business according to §19 UStG — no VAT shown.",
    client: "Client",
    name: "Name",
    clientNameMissing: "Client name is missing — it will be added before release.",
    clientEmailMissing: "Client email is missing.",
    company: "Company",
    projectDetails: "Project details",
    project: "Project",
    projectFallback: "Project",
    contractFallback: "Contract",
    serviceDescription: "Service description",
    dates: "Date(s)",
    datesMissing: "No shoot date in the plan — please add one.",
    places: "Location(s)",
    servicesDelivery: "Services & delivery",
    formats: "Formats",
    editing: "Editing",
    turnaround: "Turnaround",
    crew: "People involved",
    visualDirection: "Visual direction",
    approvals: "Approvals",
    approved: "approved",
    preparation: "Preparation",
    done: "done",
    referencesAttachments: "References & attachments",
    files: "files",
    selected: "selected",
    parts: "Props / equipment",
    conditions: "Conditions",
    license: "Usage rights",
    credit: "with credit",
    fee: "Fee",
    feeMissing: "Fee is missing — please add an amount.",
    payment: "Payment terms",
    deposit: "Deposit",
    paymentTerm: "Payment term",
    days: "days",
    vatAdd: "plus",
    vat: "VAT",
    cancellation: "Cancellation scale",
    photographerCancel: "Photographer cancellation",
    forceMajeure: "Force majeure",
    miscellaneous: "Miscellaneous",
    terms: "Terms",
    privacy: "Privacy",
    retention: "Retention",
    jurisdiction: "Jurisdiction / law",
  },
} as const;

function optionLabel(type: "licenseScope" | "licenseDuration" | "editLevel", value: string, locale: Locale): string {
  if (locale === "de") {
    const list = type === "licenseScope" ? LICENSE_SCOPES : type === "licenseDuration" ? LICENSE_DURATIONS : EDIT_LEVELS;
    return list.find((o) => o.value === value)?.label ?? value;
  }
  const labels: Record<typeof type, Record<string, string>> = {
    licenseScope: { private: "Private", commercial: "Commercial", editorial: "Editorial", unlimited: "Unlimited" },
    licenseDuration: { unbefristet: "Unlimited", "1J": "1 year", "2J": "2 years", "5J": "5 years" },
    editLevel: { basic: "Selection", standard: "Standard", advanced: "Retouching" },
  };
  return labels[type][value] ?? value;
}

function itemLine(item: { label: string; quantity?: string; format?: string; due?: string; status?: string; details?: string }, localeInput: unknown = "de"): string {
  const t = CONTRACT_COPY[normalizeLocale(localeInput)];
  return [
    item.quantity ? `${item.quantity}× ${item.label}` : item.label,
    item.format,
    item.due ? `${t.due} ${item.due}` : "",
    item.status,
    item.details,
  ].filter(Boolean).join(" · ");
}

function listPreview(values: string[], max = 8, localeInput: unknown = "de"): string {
  const t = CONTRACT_COPY[normalizeLocale(localeInput)];
  if (values.length <= max) return values.join(", ");
  return `${values.slice(0, max).join(", ")} + ${values.length - max} ${t.more}`;
}

function shotPreview(facts: ProjectFacts, localeInput: unknown = "de"): string {
  const t = CONTRACT_COPY[normalizeLocale(localeInput)];
  return facts.shots.slice(0, 10).map((shot) => [
    shot.label,
    shot.purpose,
    shot.setup ? `${t.setup}: ${shot.setup}` : "",
    shot.location ? `${t.location}: ${shot.location}` : "",
    shot.priority,
    shot.status,
  ].filter(Boolean).join(" · ")).join(" | ");
}

async function draftProse(facts: ProjectFacts, conditions: StudioConditions, language: string): Promise<string> {
  const fallback = conditions.service.description || facts.description || "";
  if (!process.env.OPENAI_API_KEY) return fallback;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sys =
      `Du fasst die Eckdaten eines Foto-Projekts zu einer sachlichen Leistungsbeschreibung für einen Dienstleistungsvertrag zusammen. ` +
      `Nutze AUSSCHLIESSLICH die gegebenen Fakten — erfinde keine Preise, Termine, Namen oder Zusagen. ` +
      `Schreibe 2–4 nüchterne Sätze in der Sprache "${language}". Gib STRICT JSON {"leistungsbeschreibung": string} zurück. Kein Vorwort.`;
    const user = JSON.stringify({
      titel: facts.title,
      beschreibung: facts.description,
      termine: facts.dates,
      orte: facts.locations,
      deliverables: facts.deliverables.map(itemLine),
      shotAnzahl: facts.shots.length,
      shotlist: facts.shots.slice(0, 12),
      moodboard: facts.moodboard,
      freigaben: facts.approvals,
      checklist: facts.checklist,
      uploads: facts.uploads.map((upload) => upload.name).slice(0, 20),
      crew: facts.crew,
      studioLeistung: conditions.service.description,
    });
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}") as { leistungsbeschreibung?: unknown };
    const text = typeof parsed.leistungsbeschreibung === "string" ? parsed.leistungsbeschreibung.trim() : "";
    return text.slice(0, 1200) || fallback;
  } catch {
    return fallback;
  }
}

export interface DraftInput {
  modules: Module[];
  facts?: ProjectFacts;
  conditions: StudioConditions;
  business: StudioBusiness;
  parties: ContractParties;
  language: string;
}

export async function draftContract(input: DraftInput): Promise<ContractDraft> {
  const { modules, conditions: c, parties, language } = input;
  const locale = normalizeLocale(language);
  const t = CONTRACT_COPY[locale];
  const facts = input.facts ?? buildProjectFacts(modules, [], locale);
  const projectSummary = await draftProse(facts, c, language);

  const gaps: { clauseId: string; hint: string }[] = [];
  const clause = (id: string, label: string, value: string, source: ClauseSource): ContractClause =>
    ({ id, label, value, source, editable: true });
  const gap = (id: string, label: string, hint: string): ContractClause => {
    gaps.push({ clauseId: id, hint });
    return { id, label, value: "", source: "needs_input", editable: true };
  };
  // keep only non-empty optional clauses
  const compact = (list: (ContractClause | null)[]): ContractClause[] => list.filter((x): x is ContractClause => !!x);

  const scopeLabel = optionLabel("licenseScope", c.license.scope, locale);
  const durationLabel = optionLabel("licenseDuration", c.license.duration, locale);
  const editLabel = optionLabel("editLevel", c.deliverables.editLevel, locale);
  const stornoText = c.cancellation.tiers
    .map((tier) => t.untilDaysBefore.replace("{days}", String(tier.untilDaysBefore)).replace("{percent}", String(tier.percent)))
    .join(" · ");
  const deliverables = facts.deliverables.map((item) => itemLine(item, locale));
  const approvedCount = facts.approvals.filter((item) => item.approved || item.status === "approved").length;
  const checklistDone = facts.checklist.filter((item) => item.checked).length;
  const selectedCount = facts.selectedUploads.length;

  const sections: ContractSection[] = [
    {
      id: "dienstleister",
      title: t.serviceProvider,
      clauses: compact([
        clause("dl_studio", t.studio, parties.photographer.studio || parties.photographer.name, "conditions"),
        clause("dl_kontakt", t.contact, [parties.photographer.name, parties.photographer.email].filter(Boolean).join(" · "), "conditions"),
        parties.photographer.address
          ? clause("dl_anschrift", t.address, parties.photographer.address, "conditions")
          : gap("dl_anschrift", t.address, t.businessAddressMissing),
        parties.photographer.vatId
          ? clause("dl_steuer", t.tax, `USt-IdNr. ${parties.photographer.vatId}`, "conditions")
          : parties.photographer.kleinunternehmer19
            ? clause("dl_steuer", t.tax, t.smallBusiness, "conditions")
            : null,
      ]),
    },
    {
      id: "kunde",
      title: t.client,
      clauses: compact([
        parties.client.name
          ? clause("ku_name", t.name, parties.client.name, "module")
          : gap("ku_name", t.name, t.clientNameMissing),
        parties.client.email
          ? clause("ku_email", "E-Mail", parties.client.email, "client")
          : gap("ku_email", "E-Mail", t.clientEmailMissing),
        parties.client.address ? clause("ku_anschrift", t.address, parties.client.address, "client") : null,
        parties.client.company ? clause("ku_firma", t.company, parties.client.company, "client") : null,
      ]),
    },
    {
      id: "projekt",
      title: t.projectDetails,
      clauses: compact([
        facts.title ? clause("pr_titel", t.project, facts.title, "module") : null,
        clause("pr_leistung", t.serviceDescription, projectSummary, projectSummary === c.service.description ? "conditions" : "generated"),
        facts.dates.length
          ? clause("pr_termine", t.dates, facts.dates.join(" · "), "module")
          : gap("pr_termine", t.dates, t.datesMissing),
        facts.locations.length ? clause("pr_orte", t.places, facts.locations.join(" · "), "module") : null,
        clause(
          "pr_deliverables",
          t.servicesDelivery,
          [
            deliverables.length ? deliverables.join(", ") : "",
            `${t.formats}: ${c.deliverables.formats.join(", ")}`,
            `${t.editing}: ${editLabel}`,
            `${t.turnaround}: ${c.deliverables.turnaround}`,
          ].filter(Boolean).join(" · "),
          deliverables.length ? "module" : "conditions",
        ),
        facts.crew.length ? clause("pr_crew", t.crew, facts.crew.join(", "), "module") : null,
        facts.shots.length ? clause("pr_shotlist", "Shotlist", shotPreview(facts, locale), "module") : null,
        facts.moodboard.length
          ? clause("pr_moodboard", t.visualDirection, facts.moodboard.map((item) => [
              item.label,
              item.status,
              item.note,
            ].filter(Boolean).join(" · ")).join(" | "), "module")
          : null,
        facts.approvals.length
          ? clause("pr_freigaben", t.approvals, `${approvedCount}/${facts.approvals.length} ${t.approved} · ${facts.approvals.map((item) => [
              item.label,
              item.status,
              item.due ? `${t.due} ${item.due}` : "",
            ].filter(Boolean).join(" · ")).join(" | ")}`, "module")
          : null,
        facts.checklist.length
          ? clause("pr_vorbereitung", t.preparation, `${checklistDone}/${facts.checklist.length} ${t.done} · ${listPreview(facts.checklist.map((item) => `${item.checked ? "✓" : "○"} ${item.label}`), 10, locale)}`, "module")
          : null,
        facts.uploads.length
          ? clause("pr_uploads", t.referencesAttachments, `${facts.uploads.length} ${t.files}${selectedCount ? ` · ${selectedCount} ${t.selected}` : ""}: ${listPreview(facts.uploads.map((upload) => upload.name), 12, locale)}`, "module")
          : null,
        facts.parts.length
          ? clause("pr_utensilien", t.parts, listPreview(facts.parts.map((item) => [
              item.quantity,
              item.name,
            ].filter(Boolean).join(" ")), 12, locale), "module")
          : null,
      ]),
    },
    {
      id: "konditionen",
      title: t.conditions,
      clauses: compact([
        clause("ko_lizenz", t.license, `${scopeLabel}, ${durationLabel}${c.license.creditRequired ? `, ${t.credit}` : ""}`, "conditions"),
        gap("ko_honorar", t.fee, t.feeMissing),
        clause(
          "ko_zahlung",
          t.payment,
          `${t.deposit} ${c.payment.depositPercent}% · ${t.paymentTerm} ${c.payment.paymentTermDays} ${t.days} · ` +
            (c.payment.kleinunternehmer19 ? t.smallBusiness : `${t.vatAdd} ${c.payment.vatRate}% ${t.vat}`),
          "conditions",
        ),
        stornoText ? clause("ko_storno", t.cancellation, stornoText, "conditions") : null,
        c.cancellation.photographerCancelClause ? clause("ko_ausfall", t.photographerCancel, c.cancellation.photographerCancelClause, "conditions") : null,
        c.cancellation.forceMajeureClause ? clause("ko_gewalt", t.forceMajeure, c.cancellation.forceMajeureClause, "conditions") : null,
      ]),
    },
    {
      id: "sonstiges",
      title: t.miscellaneous,
      clauses: compact([
        c.legal.agbRef ? clause("so_agb", t.terms, c.legal.agbRef, "conditions") : null,
        c.privacy.dataProtectionClause ? clause("so_datenschutz", t.privacy, c.privacy.dataProtectionClause, "conditions") : null,
        c.privacy.retention ? clause("so_aufbewahrung", t.retention, c.privacy.retention, "conditions") : null,
        c.legal.jurisdiction ? clause("so_recht", t.jurisdiction, c.legal.jurisdiction, "conditions") : null,
      ]),
    },
  ];

  return {
    language,
    title: facts.title || parties.client.name ? `${facts.title || t.projectFallback}${parties.client.name ? ` — ${parties.client.name}` : ""}` : t.contractFallback,
    parties,
    sections,
    gaps,
    generatedAt: Date.now(),
    model: MODEL,
  };
}
