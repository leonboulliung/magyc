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

function labelOf(list: { value: string; label: string }[], value: string): string {
  return list.find((o) => o.value === value)?.label ?? value;
}

function itemLine(item: { label: string; quantity?: string; format?: string; due?: string; status?: string; details?: string }): string {
  return [
    item.quantity ? `${item.quantity}× ${item.label}` : item.label,
    item.format,
    item.due ? `fällig ${item.due}` : "",
    item.status,
    item.details,
  ].filter(Boolean).join(" · ");
}

function listPreview(values: string[], max = 8): string {
  if (values.length <= max) return values.join(", ");
  return `${values.slice(0, max).join(", ")} + ${values.length - max} weitere`;
}

function shotPreview(facts: ProjectFacts): string {
  return facts.shots.slice(0, 10).map((shot) => [
    shot.label,
    shot.purpose,
    shot.setup ? `Setup: ${shot.setup}` : "",
    shot.location ? `Ort: ${shot.location}` : "",
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
  const facts = input.facts ?? buildProjectFacts(modules);
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

  const scopeLabel = labelOf(LICENSE_SCOPES, c.license.scope);
  const durationLabel = labelOf(LICENSE_DURATIONS, c.license.duration);
  const editLabel = labelOf(EDIT_LEVELS, c.deliverables.editLevel);
  const stornoText = c.cancellation.tiers.map((t) => `bis ${t.untilDaysBefore} Tage vorher: ${t.percent}%`).join(" · ");
  const deliverables = facts.deliverables.map(itemLine);
  const approvedCount = facts.approvals.filter((item) => item.approved || item.status === "approved").length;
  const checklistDone = facts.checklist.filter((item) => item.checked).length;
  const selectedCount = facts.selectedUploads.length;

  const sections: ContractSection[] = [
    {
      id: "dienstleister",
      title: "Dienstleister",
      clauses: compact([
        clause("dl_studio", "Studio", parties.photographer.studio || parties.photographer.name, "conditions"),
        clause("dl_kontakt", "Ansprechpartner:in", [parties.photographer.name, parties.photographer.email].filter(Boolean).join(" · "), "conditions"),
        parties.photographer.address
          ? clause("dl_anschrift", "Anschrift", parties.photographer.address, "conditions")
          : gap("dl_anschrift", "Anschrift", "Geschäftsanschrift fehlt — in den Einstellungen ergänzen."),
        parties.photographer.vatId
          ? clause("dl_steuer", "Steuer", `USt-IdNr. ${parties.photographer.vatId}`, "conditions")
          : parties.photographer.kleinunternehmer19
            ? clause("dl_steuer", "Steuer", "Kleinunternehmer gem. §19 UStG — keine USt. ausgewiesen.", "conditions")
            : null,
      ]),
    },
    {
      id: "kunde",
      title: "Kunde",
      clauses: compact([
        parties.client.name
          ? clause("ku_name", "Name", parties.client.name, "module")
          : gap("ku_name", "Name", "Kundenname fehlt — wird bei der Freigabe ergänzt."),
        parties.client.email
          ? clause("ku_email", "E-Mail", parties.client.email, "client")
          : gap("ku_email", "E-Mail", "E-Mail des Kunden fehlt."),
        parties.client.address ? clause("ku_anschrift", "Anschrift", parties.client.address, "client") : null,
        parties.client.company ? clause("ku_firma", "Firma", parties.client.company, "client") : null,
      ]),
    },
    {
      id: "projekt",
      title: "Projekt-Einzelheiten",
      clauses: compact([
        facts.title ? clause("pr_titel", "Projekt", facts.title, "module") : null,
        clause("pr_leistung", "Leistungsbeschreibung", projectSummary, projectSummary === c.service.description ? "conditions" : "generated"),
        facts.dates.length
          ? clause("pr_termine", "Termin(e)", facts.dates.join(" · "), "module")
          : gap("pr_termine", "Termin(e)", "Kein Shooting-Termin im Plan — bitte ergänzen."),
        facts.locations.length ? clause("pr_orte", "Ort(e)", facts.locations.join(" · "), "module") : null,
        clause(
          "pr_deliverables",
          "Leistungen & Lieferung",
          [
            deliverables.length ? deliverables.join(", ") : "",
            `Formate: ${c.deliverables.formats.join(", ")}`,
            `Bearbeitung: ${editLabel}`,
            `Lieferfrist: ${c.deliverables.turnaround}`,
          ].filter(Boolean).join(" · "),
          deliverables.length ? "module" : "conditions",
        ),
        facts.crew.length ? clause("pr_crew", "Beteiligte", facts.crew.join(", "), "module") : null,
        facts.shots.length ? clause("pr_shotlist", "Shotlist", shotPreview(facts), "module") : null,
        facts.moodboard.length
          ? clause("pr_moodboard", "Visuelle Richtung", facts.moodboard.map((item) => [
              item.label,
              item.status,
              item.note,
            ].filter(Boolean).join(" · ")).join(" | "), "module")
          : null,
        facts.approvals.length
          ? clause("pr_freigaben", "Freigaben", `${approvedCount}/${facts.approvals.length} freigegeben · ${facts.approvals.map((item) => [
              item.label,
              item.status,
              item.due ? `fällig ${item.due}` : "",
            ].filter(Boolean).join(" · ")).join(" | ")}`, "module")
          : null,
        facts.checklist.length
          ? clause("pr_vorbereitung", "Vorbereitung", `${checklistDone}/${facts.checklist.length} erledigt · ${listPreview(facts.checklist.map((item) => `${item.checked ? "✓" : "○"} ${item.label}`), 10)}`, "module")
          : null,
        facts.uploads.length
          ? clause("pr_uploads", "Referenzen & Anhänge", `${facts.uploads.length} Dateien${selectedCount ? ` · ${selectedCount} ausgewählt` : ""}: ${listPreview(facts.uploads.map((upload) => upload.name), 12)}`, "module")
          : null,
        facts.parts.length
          ? clause("pr_utensilien", "Utensilien / Technik", listPreview(facts.parts.map((item) => [
              item.quantity,
              item.name,
            ].filter(Boolean).join(" ")), 12), "module")
          : null,
      ]),
    },
    {
      id: "konditionen",
      title: "Konditionen",
      clauses: compact([
        clause("ko_lizenz", "Nutzungsrechte", `${scopeLabel}, ${durationLabel}${c.license.creditRequired ? ", mit Urhebernennung" : ""}`, "conditions"),
        gap("ko_honorar", "Honorar", "Honorar fehlt — bitte Betrag ergänzen."),
        clause(
          "ko_zahlung",
          "Zahlungsbedingungen",
          `Anzahlung ${c.payment.depositPercent}% · Zahlungsziel ${c.payment.paymentTermDays} Tage · ` +
            (c.payment.kleinunternehmer19 ? "Kleinunternehmer gem. §19 UStG (keine USt.)" : `zzgl. ${c.payment.vatRate}% MwSt.`),
          "conditions",
        ),
        stornoText ? clause("ko_storno", "Stornostaffel", stornoText, "conditions") : null,
        c.cancellation.photographerCancelClause ? clause("ko_ausfall", "Ausfall durch Fotograf:in", c.cancellation.photographerCancelClause, "conditions") : null,
        c.cancellation.forceMajeureClause ? clause("ko_gewalt", "Höhere Gewalt", c.cancellation.forceMajeureClause, "conditions") : null,
      ]),
    },
    {
      id: "sonstiges",
      title: "Sonstiges",
      clauses: compact([
        c.legal.agbRef ? clause("so_agb", "AGB", c.legal.agbRef, "conditions") : null,
        c.privacy.dataProtectionClause ? clause("so_datenschutz", "Datenschutz", c.privacy.dataProtectionClause, "conditions") : null,
        c.privacy.retention ? clause("so_aufbewahrung", "Aufbewahrung", c.privacy.retention, "conditions") : null,
        c.legal.jurisdiction ? clause("so_recht", "Gerichtsstand / Recht", c.legal.jurisdiction, "conditions") : null,
      ]),
    },
  ];

  return {
    language,
    title: facts.title || parties.client.name ? `${facts.title || "Projekt"}${parties.client.name ? ` — ${parties.client.name}` : ""}` : "Vertrag",
    parties,
    sections,
    gaps,
    generatedAt: Date.now(),
    model: MODEL,
  };
}
