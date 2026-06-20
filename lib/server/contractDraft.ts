import OpenAI from "openai";
import type { Module } from "@/lib/types";
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

interface ContractFacts {
  title: string;
  description: string;
  dates: string[];
  locations: string[];
  deliverables: string[];
  crew: string[];
  shotCount: number;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hasTime = /\d{2}:\d{2}/.test(iso);
  return d.toLocaleString("de-DE", hasTime ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" });
}

function labelOf(list: { value: string; label: string }[], value: string): string {
  return list.find((o) => o.value === value)?.label ?? value;
}

export function extractContractFacts(modules: Module[]): ContractFacts {
  const f: ContractFacts = { title: "", description: "", dates: [], locations: [], deliverables: [], crew: [], shotCount: 0 };
  for (const m of modules) {
    switch (m.type) {
      case "heading": if (!f.title && m.text) f.title = m.text.trim(); break;
      case "rich_text": if (!f.description && m.text) f.description = m.text.trim(); break;
      case "appointment": if (m.datetime) f.dates.push(fmtDate(m.datetime)); break;
      case "appointments": for (const e of m.entries || []) if (e.datetime) f.dates.push((e.label ? `${e.label}: ` : "") + fmtDate(e.datetime)); break;
      case "date": if (m.date) f.dates.push(fmtDate(m.date)); break;
      case "location_single": if (m.label) f.locations.push(m.label); break;
      case "locations_multi": for (const l of m.locations || []) if (l.label) f.locations.push(l.label); break;
      case "deliverables": for (const it of m.items || []) if (it.label) f.deliverables.push(it.quantity ? `${it.quantity}× ${it.label}` : it.label); break;
      case "shot_list": f.shotCount += (m.shots || []).length; break;
      case "crew": for (const r of m.roles || []) if (r.name) f.crew.push(r.name); break;
      default: break;
    }
  }
  return f;
}

async function draftProse(facts: ContractFacts, conditions: StudioConditions, language: string): Promise<string> {
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
      deliverables: facts.deliverables,
      shotAnzahl: facts.shotCount,
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
  conditions: StudioConditions;
  business: StudioBusiness;
  parties: ContractParties;
  language: string;
}

export async function draftContract(input: DraftInput): Promise<ContractDraft> {
  const { modules, conditions: c, parties, language } = input;
  const facts = extractContractFacts(modules);
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
            facts.deliverables.length ? facts.deliverables.join(", ") : "",
            `Formate: ${c.deliverables.formats.join(", ")}`,
            `Bearbeitung: ${editLabel}`,
            `Lieferfrist: ${c.deliverables.turnaround}`,
          ].filter(Boolean).join(" · "),
          facts.deliverables.length ? "module" : "conditions",
        ),
        facts.crew.length ? clause("pr_crew", "Beteiligte", facts.crew.join(", "), "module") : null,
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
