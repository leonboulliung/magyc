# Contract fields & conditions — implementation spec

_Status: design (research only, not built). Companion to
[CONTRACT_PHASE.md](CONTRACT_PHASE.md), which decides the **concept** (the
Absegnung phase, the sign-off mechanism, the legal framing). This document
decides the **fields**: the photographer's reusable conditions, the contract
page structure, the agentic mapping from project modules → contract draft, and
the data model the settings + migration are built from._

Legal framing is honest throughout (per CONTRACT_PHASE.md): MVP sign-off is
**Klick-Zustimmung / SES** ("verbindliche, dokumentierte Freigabe", *not* a
qualified signature). QES only ever via an external EU QTSP, later.

Scope guard: this spec changes **no feature code**. It is the blueprint Leon
builds the Studio condition fields + the `project_contracts` migration from.

---

## 0. Design principles

1. **Fill once, reuse everywhere.** Conditions live in Studio settings
   (`settings.conditions`), next to the existing `rules` / `fastPrompts`. The
   photographer configures the studio standard **once**; projects inherit it.
   A project may override a small set of per-project values (price, dates) — it
   never re-asks the studio-level stuff (Mwst status, AGB link, retention).
2. **The plan is the contract.** Wherever a value already exists as a project
   **module** (deliverables, shot_list, appointments, locations…), the agent
   pulls it — the photographer does not retype. Conditions fill the legal
   scaffolding the modules don't carry (price, usage rights, cancellation).
3. **Draft → review → sign.** The AI only ever produces a **reviewable draft**.
   Nothing AI-written binds anyone until the owner has reviewed/edited it and
   both parties have actively signed. No blind binding of generated text.
4. **Lean.** Mark a minimal **MVP set**; everything else is "later". A
   photographer should never face a 40-field form.

---

## 1. Photographer condition parameters ("Konditionen")

Legend:
- **Scope**: `studio` = filled once in settings · `project` = per-project (often
  pre-filled from the studio default, then adjusted) · `both` = studio default +
  project override.
- **MVP**: ✅ = in the minimal first build · ◻️ = later.
- Input types map to the settings/contract field renderer (see §4 `kind`).

### Group A — Leistung & Umfang
| Parameter (DE) | Captures | Input type | Default | Scope | MVP |
|---|---|---|---|---|---|
| Leistungsbeschreibung | Free description of the service ("Hochzeitsreportage, ganztägig") | long text | "" | both | ✅ |
| Shooting-Dauer | Hours/days on set | text (e.g. "8 Std.") | "" | project | ✅ |
| Anzahl Setups/Locations | How many locations/setups included | number | — | project | ◻️ |
| Vorbesprechung enthalten | Pre-shoot consult included? | toggle | true | studio | ◻️ |
| Zusatzleistungen | Add-ons (2nd shooter, Making-of…) | multi-select (studio-defined list) | [] | project | ◻️ |

### Group B — Deliverables (Anzahl Bilder, Formate, Bearbeitung)
| Parameter (DE) | Captures | Input type | Default | Scope | MVP |
|---|---|---|---|---|---|
| Anzahl finaler Bilder | Guaranteed count of edited images | number | — | project | ✅ |
| Lieferformat | Digital download / Galerie / Print / USB | multi-select | ["Digitaler Download"] | studio | ✅ |
| Auflösung | Web / hochauflösend / RAW | select (`web` \| `highres` \| `raw`) | "highres" | studio | ◻️ |
| Bearbeitungsumfang | Edit depth: Auswahl/Standard/Retusche | select (`basic` \| `standard` \| `advanced`) | "standard" | studio | ✅ |
| RAW-Dateien enthalten | RAWs handed over? | toggle | false | studio | ◻️ |
| Lieferfrist | Delivery turnaround | text (e.g. "4 Wochen") + or number-of-days | "4 Wochen" | both | ✅ |

### Group C — Nutzungsrechte / Lizenz
| Parameter (DE) | Captures | Input type | Default | Scope | MVP |
|---|---|---|---|---|---|
| Lizenzumfang | Scope of granted rights | select (`private` \| `commercial` \| `editorial` \| `unlimited`) | "private" | both | ✅ |
| Lizenzdauer | Time the rights run | select (`unbefristet` \| `1J` \| `2J` \| `5J` \| `custom`) | "unbefristet" | both | ✅ |
| Räumlicher Geltungsbereich | Territory | select (`DE` \| `DACH` \| `EU` \| `weltweit`) | "weltweit" | studio | ◻️ |
| Exklusivität | Exclusive vs. non-exclusive | toggle (`exklusiv`) | false | project | ◻️ |
| Bearbeitung/Weitergabe erlaubt | Client may edit / sublicense | toggle | false | studio | ◻️ |
| Urhebernennung | Credit "Foto: …" required | toggle | true | studio | ✅ |

### Group D — Preis & Zahlung
| Parameter (DE) | Captures | Input type | Default | Scope | MVP |
|---|---|---|---|---|---|
| Honorar (netto/brutto) | The fee | number-with-currency € | — | project | ✅ |
| Preisbasis | Pauschal / Stundensatz / Tagessatz | select (`flat` \| `hourly` \| `daily`) | "flat" | studio | ◻️ |
| Anzahlung | Deposit | percent (%) | 30 | studio | ✅ |
| Zahlungsziel | Days to pay after invoice | number (days) | 14 | studio | ✅ |
| Reisekosten | Travel cost handling | select (`inkl` \| `pauschale` \| `nach_aufwand`) + number € | "inkl" | both | ◻️ |
| Kleinunternehmer §19 UStG | No VAT shown (§19) | toggle | false | studio | ✅ |
| Mwst-Satz | VAT rate if not §19 | select (`19` \| `7`) % | 19 | studio | ✅ |

> If **Kleinunternehmer §19** is on, the contract renders the §19 UStG note and
> suppresses the VAT line. This is the one cross-field rule the renderer needs.

### Group E — Termine & Fristen
| Parameter (DE) | Captures | Input type | Default | Scope | MVP |
|---|---|---|---|---|---|
| Shooting-Termin(e) | The shoot date(s) | date / multi-date | — | project (from module) | ✅ |
| Lieferdatum | Concrete delivery date | date | — | project | ◻️ |
| Bindungsfrist Angebot | How long the offer/draft is valid | number (days) | 14 | studio | ◻️ |

### Group F — Storno / Ausfall
| Parameter (DE) | Captures | Input type | Default | Scope | MVP |
|---|---|---|---|---|---|
| Stornostaffel | Cancellation fee tiers | structured: list of `{ bisTageVorher: number, prozent: number }` | `[{30,50},{7,80},{0,100}]` | studio | ✅ |
| Ausfall durch Fotograf:in | What happens if photographer cancels (Ersatztermin/Rückzahlung) | long text | studio default clause | studio | ◻️ |
| Höhere Gewalt | Force-majeure handling | long text | studio default clause | studio | ◻️ |

### Group G — Veröffentlichung & Modelfreigabe
| Parameter (DE) | Captures | Input type | Default | Scope | MVP |
|---|---|---|---|---|---|
| Veröffentlichung durch Fotograf:in | May the photographer publish images (Portfolio/Web/Social)? §22/23 KunstUrhG | toggle | false | project | ✅ |
| Umfang der Freigabe | Where: Portfolio / Website / Social / Print / Wettbewerbe | multi-select | [] | project | ◻️ |
| Widerrufsvorbehalt | Client may revoke publication consent | toggle | true | studio | ◻️ |
| Model-Release Personen | Names of depicted persons consenting | text list | [] | project | ◻️ |

> Legal note for the renderer: publication of recognizable persons needs the
> depicted person's consent (§22 KunstUrhG; §823/§1004 BGB · Art. 6 DSGVO).
> The toggle is **opt-in**, default **off** — honest, not pre-checked.

### Group H — Datenschutz / AVV / AGB
| Parameter (DE) | Captures | Input type | Default | Scope | MVP |
|---|---|---|---|---|---|
| AGB-Verweis | Link/reference to the studio's AGB | url + short text | "" | studio | ✅ |
| Datenschutzhinweis | DSGVO processing notice | long text | studio default clause | studio | ◻️ |
| AVV nötig | Order-processing agreement applies (esp. B2B) | toggle | false | studio | ◻️ |
| Aufbewahrung/Löschfrist | How long files are kept | text (e.g. "12 Monate") | "12 Monate" | studio | ◻️ |
| Gerichtsstand / Recht | Jurisdiction + applicable law | text | "Recht der BRD" | studio | ◻️ |

### MVP set (the lean first build)

Studio settings (filled once): **Lieferformat, Bearbeitungsumfang, Anzahlung %,
Zahlungsziel, Kleinunternehmer §19 / Mwst-Satz, Urhebernennung, Stornostaffel,
AGB-Verweis** + the two default clause texts (Ausfall, Datenschutz).

Per project (often pre-filled, sometimes edited): **Leistungsbeschreibung,
Anzahl finaler Bilder, Lieferfrist, Lizenzumfang, Lizenzdauer, Honorar €,
Shooting-Termin, Veröffentlichung durch Fotograf:in**.

Everything else is "later" (◻️). The MVP is ~8 studio fields + ~8 project fields,
and most project fields auto-fill from modules (§3).

---

## 2. Standardized contract page structure

Five sections (matches CONTRACT_PHASE.md's "Vertragsinhalt"), each field tagged
with its **data source**:

- `studio` — Studio settings (`profile.settings.conditions` / `studioProfile`)
- `clerk` — the photographer's Clerk profile (name, email, avatar)
- `module` — pulled from a project module (see §3 mapping)
- `client` — entered by the client at sign-off, or by owner on their behalf

### 2.1 Dienstleister-Daten (the photographer / studio)
| Field | Source |
|---|---|
| Studio-/Anzeigename | `studio` (`StudioProfile.displayName`) |
| Ansprechpartner:in (Name) | `clerk` (full name) |
| E-Mail | `clerk` (primary email) |
| Anschrift / USt-IdNr / Steuernr. | `studio` (new `studioProfile` business fields — see §4.0) |
| §19-Kleinunternehmer-Hinweis | `studio` (`conditions.payment.kleinunternehmer19`) |

### 2.2 Kunden-Daten (the client)
| Field | Source |
|---|---|
| Name | `client` (or `module`: project `client` field if captured at brief) |
| E-Mail | `client` |
| Anschrift | `client` |
| Firma / Rechnungsadresse (optional) | `client` |

> The brief builder already collects a `client` string (`app/api/projects`
> `buildBriefInput`). That seeds the Kunde name; the rest the client completes
> at the sign-off step.

### 2.3 Projekt-Einzelheiten (the plan → contract)
| Field | Source |
|---|---|
| Projekttitel | `module` (`heading`) |
| Kurzbeschreibung | `module` (`rich_text`) / `studio` Leistungsbeschreibung |
| Shooting-Termin(e) | `module` (`appointment` / `appointments` / `date`) |
| Location(s) | `module` (`location_single` / `locations_multi` / `location_suggestions` / `route`) |
| Deliverables (Anzahl, Format, Frist) | `module` (`deliverables`) + `studio` defaults |
| Shotlist-Umfang (optional Anhang) | `module` (`shot_list`) |
| Visuelle Richtung (optional Anhang) | `module` (`moodboard`) |
| Crew / Beteiligte | `module` (`crew`, `work_packages`) |

### 2.4 Konditionen (the legal scaffolding)
| Field | Source |
|---|---|
| Leistungsumfang | `studio`/`project` (Group A) |
| Nutzungsrechte / Lizenz | `studio`/`project` (Group C) |
| Preis & Zahlung (Honorar, Anzahlung, Zahlungsziel, Mwst) | `project` (Honorar) + `studio` (rest) (Group D) |
| Storno / Ausfall | `studio` (Group F) |
| Veröffentlichung & Modelfreigabe | `project` (Group G) |
| Datenschutz / AVV | `studio` (Group H) |

### 2.5 Sonstiges
| Field | Source |
|---|---|
| AGB-Verweis | `studio` (`conditions.legal.agbRef`) |
| Gerichtsstand / anwendbares Recht | `studio` |
| Freitext-Zusätze (owner) | `client`-facing but owner-authored free clauses |
| Sign-off-Block (Name, Datum, Zustimmung) | `client` + audit (§5) |

---

## 3. Agentic AI flow — module → contract mapping

The agent's job: take **studio conditions** + **project modules** + **parties**
and emit a **structured, reviewable contract draft (JSON)**. It NEVER signs and
NEVER invents legal facts — it maps existing data and phrases studio clause
defaults into contract prose. Anything it can't source is left as an explicit
`"needs_input"` gap for the owner.

### 3.1 Mapping table (module type → contract field)
| Project module (`lib/types.ts`) | Feeds contract field(s) | Notes |
|---|---|---|
| `heading` | Projekttitel | direct |
| `rich_text` | Kurzbeschreibung / Leistungsbeschreibung | fallback to studio Leistungsbeschreibung |
| `tags` | — (context only) | informs phrasing, not a field |
| `deliverables` | Anzahl Bilder, Lieferformat, Lieferfrist | `items[].quantity/format/due` → Group B fields |
| `shot_list` | Leistungsumfang detail; optional Anhang | count of `must` shots can corroborate Anzahl Bilder |
| `appointment` / `appointments` | Shooting-Termin(e) | ISO datetimes → Termine |
| `date` | Shooting-Termin / Lieferdatum | day-only |
| `range` (unit=date/time) | Shooting-Dauer / Zeitfenster | from–to span |
| `location_single` / `locations_multi` | Location(s) | label + coords → address line |
| `location_suggestions` | Location(s) (tentative) | flag as "noch festzulegen" if unvoted |
| `route` | Location(s) / Ablauf | multi-stop |
| `crew` | Crew / Beteiligte | role names |
| `work_packages` | Leistungsumfang / Crew | package labels |
| `moodboard` | Visuelle Richtung (Anhang) | directions w/ status |
| `table` | Generic — map columns heuristically (e.g. Preis/Pos.) | only if columns look price/scope-like |
| `phases` | Ablauf / Termine | phase labels → timeline |
| `approvals` | Freigaben / Meilensteine | informs Termine & Fristen |
| `notes` / `qa` / `discussion` | — (not contract content) | excluded; collaboration scratch |
| `checklist` | — (prep, internal) | excluded |
| `selection` / `images` / `attachments` / `audio` / `sketch` / `gif` / `icon` / `wikipedia` / `ai_summary` / `poll` / `parts_list` | — | excluded from contract body |

Rule of thumb baked into the prompt: **only deliverables/timing/location/scope
modules become contract content.** Collaboration, media, and decoration modules
are ignored. Anything price/usage/payment/cancellation comes from
**conditions**, never invented from modules.

### 3.2 Agent task definition

```
INPUTS
  conditions  : StudioConditions          // §4 — studio defaults
  overrides   : ProjectConditionOverrides // §4 — per-project edits (may be {})
  modules     : Module[]                   // the project's plan
  parties     : { photographer: {...clerk+studio}, client: {...} }
  language    : string                     // space language (de default)

OUTPUT
  ContractDraft (JSON, §3.4) — sections + clauses, each clause flagged
  source ('module' | 'conditions' | 'generated' | 'needs_input') so the
  review UI can show provenance and highlight gaps.
```

The agent does **extraction + light phrasing**, not legal authorship: clause
*texts* come from studio defaults (Group F/H long-text clauses); the agent fills
**slots** (counts, dates, names, prices) and assembles section order. Generated
prose is limited to connective sentences ("Die Leistung umfasst …"), in the
space language, and is always editable.

### 3.3 Where the LLM call fits

Follow the existing `lib/server/classify.ts` pattern exactly:
- **Model**: `gpt-4o-mini`, `response_format: { type: "json_object" }`,
  `temperature: 0.2` (extraction must be stable, like `analyze()`).
- **Location**: new `lib/server/contractDraft.ts`, called from a new
  `POST /api/projects/[id]/contract/draft` route (owner-only, Clerk-auth),
  mirroring how `app/api/projects/route.ts` wraps `classifyInput`.
- **Observability**: log via `recordAiEvent({ eventType: "contract_draft",
  model: "gpt-4o-mini", … })` — the table + helper already exist.
- **Determinism guard**: numbers/dates/prices are *taken from the inputs*, not
  the model — the server passes them in and the model only arranges/phrases. The
  server re-validates every slot against the source module/condition after the
  call (same spirit as the sanitizers in `lib/modules.ts`).

**Prompt sketch (system):**
```
You assemble a German service-contract DRAFT for a photographer from
structured inputs. You do NOT invent prices, dates, counts, names or legal
terms — use ONLY the values given. Phrase connective sentences in {language}.
For every contract field, output its value AND a "source" tag
(module|conditions|generated|needs_input). If a required value is missing,
emit "needs_input" with a short hint — never guess. Clause bodies for
cancellation / data-protection come verbatim from the provided studio clause
texts; you only fill {slots}. Return STRICT JSON matching the schema. No
preamble.
```
User message = JSON of `{ conditions, overrides, modules (filtered to the
contract-relevant types from §3.1), parties, language }`.

### 3.4 Output JSON shape (`ContractDraft`)

```jsonc
{
  "language": "de",
  "title": "Hochzeit Anna & Tom — Reportage",
  "parties": {
    "photographer": { "name": "...", "studio": "...", "email": "...",
                      "address": "...", "vatId": "...", "kleinunternehmer19": true },
    "client": { "name": "...", "email": "...", "address": "...", "company": "" }
  },
  "sections": [
    {
      "id": "projekt",                       // projekt|konditionen|sonstiges
      "title": "Projekt-Einzelheiten",
      "clauses": [
        {
          "id": "termine",
          "label": "Shooting-Termin",
          "value": "14.09.2026, 11:00",
          "source": "module",               // module|conditions|generated|needs_input
          "ref": { "moduleType": "appointment", "moduleIndex": 5 },
          "editable": true
        }
        // ...
      ]
    }
    // sections: dienstleister, kunde, projekt, konditionen, sonstiges
  ],
  "gaps": [                                  // every needs_input, surfaced for review
    { "clauseId": "honorar", "hint": "Honorar fehlt — bitte Betrag ergänzen." }
  ],
  "generatedAt": 1750000000000,
  "model": "gpt-4o-mini"
}
```

This is the **draft** the owner reviews/edits. On "freigeben & senden", the
edited draft is frozen into `project_contracts.clauses` (§4.2) and hashed.

---

## 4. Data model

### 4.0 New business fields on the studio profile (prerequisite)

The contract needs the photographer's legal identity, which `StudioProfile`
doesn't carry yet. Add to `StudioProfile` (persisted on the `profiles` row,
extends migration 014):

```ts
business: {
  legalName: string;     // "Max Mustermann Fotografie"
  address: string;       // multi-line
  vatId: string;         // USt-IdNr. (empty if §19)
  taxNumber: string;     // Steuernummer
  phone: string;
}
```
(All optional, sanitized like the existing string fields in `studioProfile.ts`.)

### 4.1 Settings JSON shape — `StudioConditions`

Lives at `profile.settings.conditions`. Built so the settings UI can be
generated field-by-field from it (extend `StudioSettings` in
`lib/studioProfile.ts`; add a `cleanConditions()` alongside `cleanSettings()`,
following the same defensive pattern). Keys, types, enums are exact:

```ts
export interface StudioConditions {
  service: {
    description: string;                 // long text
    consultIncluded: boolean;            // default true
    addons: string[];                    // studio-defined add-on labels
  };
  deliverables: {
    formats: DeliveryFormat[];           // multi-select
    resolution: "web" | "highres" | "raw";   // default "highres"
    editLevel: "basic" | "standard" | "advanced"; // default "standard"
    includeRaw: boolean;                 // default false
    turnaround: string;                  // "4 Wochen"
  };
  license: {
    scope: "private" | "commercial" | "editorial" | "unlimited"; // default "private"
    duration: "unbefristet" | "1J" | "2J" | "5J" | "custom";     // default "unbefristet"
    durationCustom: string;              // used when duration === "custom"
    territory: "DE" | "DACH" | "EU" | "weltweit";  // default "weltweit"
    allowEditing: boolean;               // default false (edit/sublicense)
    creditRequired: boolean;             // default true (Urhebernennung)
  };
  payment: {
    basis: "flat" | "hourly" | "daily";  // default "flat"
    depositPercent: number;              // 0–100, default 30
    paymentTermDays: number;             // default 14
    travel: "inkl" | "pauschale" | "nach_aufwand";  // default "inkl"
    travelAmount: number;                // € when travel === "pauschale"
    kleinunternehmer19: boolean;         // default false
    vatRate: 19 | 7;                     // default 19 (ignored if §19 on)
  };
  cancellation: {
    tiers: { untilDaysBefore: number; percent: number }[];
    // default [{30,50},{7,80},{0,100}]
    photographerCancelClause: string;    // long-text default clause
    forceMajeureClause: string;          // long-text default clause
  };
  publication: {
    revocable: boolean;                  // default true (Widerrufsvorbehalt)
    // NB: the actual "darf veröffentlichen" flag is PER-PROJECT (opt-in), not here
  };
  privacy: {
    dataProtectionClause: string;        // long-text default
    avvRequired: boolean;                // default false
    retention: string;                   // "12 Monate"
  };
  legal: {
    agbRef: string;                      // URL or reference text
    jurisdiction: string;                // "Recht der BRD"
    offerValidityDays: number;           // default 14
  };
}

export type DeliveryFormat =
  | "Digitaler Download" | "Online-Galerie" | "Print" | "USB-Stick" | "Fotobuch";

export const DEFAULT_CONDITIONS: StudioConditions = { /* defaults above */ };
```

**Per-project overrides** (`ProjectConditionOverrides`) — only the fields a
project legitimately changes; everything absent inherits the studio default:

```ts
export interface ProjectConditionOverrides {
  service?: { description?: string; durationLabel?: string };
  deliverables?: { finalImageCount?: number; turnaround?: string };
  license?: {
    scope?: StudioConditions["license"]["scope"];
    duration?: StudioConditions["license"]["duration"];
    exclusive?: boolean;
  };
  payment?: { feeEur?: number };          // Honorar — per project, no studio default
  dates?: { deliveryDate?: string };      // ISO; shoot dates come from modules
  publication?: {
    allowedByPhotographer?: boolean;      // §22/23 opt-in, default false
    surfaces?: string[];                  // Portfolio/Web/Social/…
    modelReleaseNames?: string[];
  };
  freeClauses?: { title: string; body: string }[];  // owner free additions
}
```

Stored on the project (a `condition_overrides jsonb` column on `spaces`, or
inside the contract row at draft time — recommend the latter so a project with
no contract stays clean).

### 4.2 `project_contracts` migration sketch (015)

Builds on CONTRACT_PHASE.md's sketch; adds `signers` (both parties),
`owner_signed_at`, `content_hash`, `locked` immutability, and an explicit
`condition_overrides` snapshot so the contract is self-contained.

```sql
-- supabase/migrations/015_project_contracts.sql
create table if not exists project_contracts (
  space_id            text primary key references spaces(id) on delete cascade,
  parties             jsonb not null default '{}'::jsonb,   -- { photographer, client }
  condition_overrides jsonb not null default '{}'::jsonb,   -- ProjectConditionOverrides snapshot
  conditions_snapshot jsonb not null default '{}'::jsonb,   -- StudioConditions at draft time (immutable copy)
  clauses             jsonb not null default '[]'::jsonb,   -- the reviewed ContractDraft.sections
  draft_meta          jsonb,                                -- { model, generatedAt, gaps }
  mode                text not null default 'click',        -- 'click' | 'esign'
  esign_level         text,                                 -- 'ses' | 'aes' | 'qes' (mode=esign)
  esign_provider_ref  text,                                 -- QTSP envelope id (later)
  status              text not null default 'draft',        -- draft|sent|owner_signed|signed|declined
  signers             jsonb not null default '[]'::jsonb,   -- [{ role, name, email, ip, ua, signedAt }]
  owner_signed_at     timestamptz,
  client_signed_at    timestamptz,
  signed_at           timestamptz,                          -- set when BOTH have signed
  content_hash        text,                                 -- sha256 of the frozen clauses+parties
  pdf_path            text,                                 -- storage path of generated PDF
  locked              boolean not null default false,       -- true once signed_at set → immutable
  audit               jsonb not null default '[]'::jsonb,   -- append-only event log (§5)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Immutability: once locked, only the lock-related columns may not change.
-- Enforce in the API layer (reject writes when locked = true), mirroring how
-- spaces writes are gated server-side; optionally a trigger as defence-in-depth.
create index if not exists project_contracts_status_idx on project_contracts(status);
```

Notes:
- **`conditions_snapshot`**: a frozen copy of `StudioConditions` at draft time so
  later settings edits never alter a signed contract (CONTRACT_PHASE.md
  "Snapshot" requirement).
- **`signers` array** holds BOTH parties; `signed_at` is set only when both
  `owner_signed_at` and `client_signed_at` exist → flips `locked = true`.
- **"Ready" signals** from Planung stay separate (CONTRACT_PHASE.md: reuse
  `module_state` at a sentinel index) — not part of this table.

---

## 5. Sign + lock + PDF — how the existing plan slots in

Confirms CONTRACT_PHASE.md, with the extra data-model needs flagged.

1. **Klick-Zustimmung (SES, formfrei).** Each party enters full name + ticks an
   explicit consent checkbox + presses a button. We capture **name, server
   timestamp, IP, user-agent, content hash, mode** into `signers[]` + `audit`.
   Framed as **"verbindliche Freigabe"**, never "qualifizierte Unterschrift".
   This is the MVP; QES only later via an EU QTSP (`mode='esign'`,
   `esign_level`, `esign_provider_ref`).
2. **Audit trail** = append-only `audit jsonb` array; each entry
   `{ event, role, name, ts, ip, ua, contentHash }`. Events:
   `draft_created · sent · owner_signed · client_signed · locked · pdf_generated
   · emailed`.
3. **Immutable after both parties sign.** When the second signature lands, set
   `signed_at`, `locked = true`. The contract API rejects all further mutations
   to a locked row (server-enforced, like existing space writes); the
   `conditions_snapshot` + `clauses` are the frozen record.
4. **PDF export.** On lock, generate a branded PDF (parties + conditions + clauses
   + the sign-off evidence) → store in Supabase Storage → `pdf_path`.
   Downloadable by both sides. (New storage bucket, e.g. `contracts/`, private.)
5. **Auto-email (later).** After lock + PDF, email the client the signed PDF
   (the repo already uses Resend in a sibling project pattern); `audit` records
   the `emailed` event. Not MVP.

**Extra data-model needs beyond CONTRACT_PHASE.md's sketch** (all included in
§4.2): `conditions_snapshot`, `condition_overrides`, split `owner_signed_at` /
`client_signed_at`, `signers[]` (both parties), `locked`, `updated_at`, and the
five new `business` fields on `StudioProfile` (§4.0).

---

## 6. Build order (suggested, lean-first)

1. **Studio settings — Konditionen.** Extend `StudioSettings` with `conditions`
   (§4.1) + `business` (§4.0); add `cleanConditions()`; build the settings card
   section from the MVP set (§1) by extending
   `app/studio/(shell)/settings/page.tsx`.
2. **`project_contracts` migration 015** (§4.2).
3. **Contract draft agent** (`lib/server/contractDraft.ts` +
   `POST /api/projects/[id]/contract/draft`, §3) producing `ContractDraft`.
4. **Absegnung page** (CONTRACT_PHASE.md MVP cut #1–2): render the draft,
   owner review/edit, provenance + gaps.
5. **Klick-Zustimmung + audit + lock + PDF** (§5; CONTRACT_PHASE.md #3).
6. Later: per-project overrides UI polish, e-sign (AES) via one EU QTSP,
   auto-email.
```
