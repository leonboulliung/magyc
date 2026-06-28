# Auswahl — Vertrag und Freigabe

_Status: implemented MVP. Decided with Leon, 2026-06. The earlier
`agreement` grid widget was removed — a binding sign-off does not belong as a
playful card in the dot-grid; it gets a dedicated, document-like surface._

## Implemented state (2026-06-22)

The MVP cut below is built (Mode A / click-consent). Current behaviour:

- **Stage lock.** Moving a project to Absegnung (`stage = production`) is gated
  by a confirmation dialog in `StudioProjectBar`; once locked, the project page
  (`/s/[id]`) is read-only (`SpaceView`: `act` no-ops with a toast, owner chrome
  hidden). Returning to Planung is also confirmed, and the API
  (`PATCH /api/projects/[id]`) refuses `stage = "brief"` once a contract is
  `locked` (409 `contract_signed`).
- **Contract page** lives at a dedicated route `/s/[id]/vertrag`
  (`ContractView`), not inside `/s/[id]`. Advancing to Auswahl generates and
  persists the draft automatically before the phase change succeeds. The owner
  edits it in place; changes autosave through `PUT …/contract`.
- **Release gate.** The owner chooses text confirmation or a drawn signature,
  then explicitly releases the current document in one atomic request:
  `POST /api/projects/[id]/contract/release` stores the reviewed document,
  signing method, content hash and `status = "released"` together.
  Before release the client sees only a "Vertrag wird vorbereitet" page; after
  release both parties sign (`POST …/contract/sign`, gated to released statuses).
  After both sign, the contract is `locked` and the client sees "Dein Projekt
  ist in Arbeit" with a link back to the plan.
- **Status values used** on `project_contracts.status`: `draft` (autosaved,
  still being prepared) → `released` → `owner_signed` / `client_signed` (one party in)
  → `signed` (+ `locked = true`). No migration was needed — `status` is a free
  text column.

## Principle

MAGYC owns **"between idea and execution"**. The project page is where a vague
idea is collaboratively explored and structured (Planung). The **Absegnung
phase turns that agreed plan into a binding contract** on a dedicated page —
this is the wedge that makes MAGYC "the place where a creative project gets
signed off", not just another planning toy.

Lifecycle: **Planung → Absegnung → Abschluss** (stage ids unchanged:
`brief → production → handoff`).

## Flow

1. **Planung** — collaborative project page (today's grid). Stays as is, with
   one addition: each participant can give a **"ready" signal** (a per-person
   toggle near the participants strip). The owner sees "X von Y bereit" and
   knows when everyone is aligned. Optional, non-blocking.
2. **Owner advances** the project to Absegnung (existing stage stepper).
3. **Absegnung** — a **dedicated contract page** (not the grid). The plan is
   presented at contract level + the client signs off (see below).
4. **Abschluss** — the signed contract + plan are archived as the project
   record; project is done.

## The contract page

A clean, focused, document-like surface (think Angebot / Auftragsbestätigung),
reachable for the client via the existing share link `/s/[id]` when the project
is in Absegnung (the space view switches to the contract surface for this
stage), and editable by the owner.

**Content**
- Header: project title, **parties** (Fotograf:in/Studio + Kunde), date.
- **Vertragsinhalt / Konditionen**, built from two layers:
  - *Auto-zusammengefasst aus dem Plan*: deliverables, shot count, locations,
    termine, Nutzungsrechte — "der Plan wird zum Vertrag". (Pulled from the
    project's modules so the photographer doesn't retype.)
  - *Owner-editable clauses*: Leistungsumfang, Nutzungsrechte, Preis/Zahlung,
    Storno/Ausfall, Verweis auf AGB. Reusable defaults live in Studio settings
    (ties into the existing `settings.rules`) so a studio configures its
    standard clauses once.
- A readable, branded layout. No dot-grid chrome.

## Sign-off — photographer-configurable

The owner picks the mechanism per project (or a studio default in settings):

- **A — Klick-Zustimmung (Textform).** Client enters full name + an explicit
  checkbox + button. We capture name, **server timestamp, IP, user-agent, and a
  content hash/snapshot**. Legally a documented Willenserklärung/Vertragsannahme
  for formfreie Dienstleistungsverträge — *not* a qualified signature, so it is
  marketed as **"verbindliche Freigabe"**, not "Unterschrift". Fast, zero
  friction. This is the MVP.
- **B — E-Signatur (eIDAS).** Integrate an **EU/DE Qualified Trust Service
  Provider** rather than building it. eIDAS levels:
  - **SES** (Simple) ≈ option A done by a provider.
  - **AES** (Advanced) — identity-bound, tamper-evident; the sensible "clean"
    default for photo contracts.
  - **QES** (Qualified) — highest, ID-verified; overkill for most shoots,
    offer as a top tier.
  Candidate providers (EU data residency, AVV): **Skribble** (SES/AES/QES),
  **Yousign** (FR/EU), **D-Trust/Bundesdruckerei sign-me** (DE QES), **Scrive**.
  → Recommendation: start with **A (Klick)** for the MVP; add **B via one EU
  provider at AES** as the Pro/compliance upgrade.

**Output (both modes):** a generated **PDF** (parties + conditions + the
sign-off evidence/audit trail) stored and downloadable by both sides. After
sign-off the contract is **locked/immutable**; the project may advance to
Abschluss.

## Compliance design

- **EU-Datenresidenz** + AVV with any e-sign subprocessor (the report's wedge).
- **Audit trail**: name, role, timestamp (server), IP, UA, content hash, mode.
- **Snapshot**: store the exact agreed version (so later edits can't alter it).
- **Aufbewahrung**: keep the signed PDF + trail (good practice; align with
  §147 AO / §257 HGB if it becomes invoice-adjacent).
- **Honest framing**: "verbindliche, dokumentierte Freigabe" for A; only call it
  "qualifizierte E-Signatur" when a QTSP at QES is actually used.

## Data model (sketch — needs a migration)

A dedicated `project_contracts` row per space (not module_state):
```
project_contracts(
  space_id        text primary key references spaces(id),
  parties         jsonb,        -- { photographer, client }
  clauses         jsonb,        -- structured + free terms
  mode            text,         -- 'click' | 'esign'
  esign_level     text,         -- 'ses' | 'aes' | 'qes' (when mode=esign)
  status          text,         -- 'draft' | 'sent' | 'signed' | 'declined'
  signer          jsonb,        -- { name, email, ip, ua }
  signed_at       timestamptz,
  content_hash    text,
  pdf_path        text,
  provider_ref    text,         -- e-sign envelope id
  audit           jsonb,
  created_at      timestamptz default now()
)
```
"Ready" signals can reuse a small space-scoped action (or `module_state` at a
sentinel index) — one row per participant, toggled.

## MVP cut (build order, separate step)

1. **Dedicated Absegnung page** + the stage switch on `/s/[id]`.
2. **Contract content**: auto-summary from plan + owner-editable clauses (+
   studio default clauses in settings).
3. **Mode A (Klick-Zustimmung)** with full audit trail + **PDF generation**.
4. **Ready signals** in Planung (optional, small).
5. **Mode B (EU e-sign, AES)** as the Pro upgrade — one provider integration.

## Open decisions for Leon

- Which **e-sign provider** + level to commit to for Mode B (Skribble / Yousign
  / sign-me …). Affects pricing tier + AVV.
- Where the **contract page lives**: a stage-switched view inside `/s/[id]`
  (client-facing, simplest) vs. a separate route.
- **Contract template source**: fully AI-summarized from the plan, fully manual,
  or a hybrid with studio default clauses (recommended: hybrid).
