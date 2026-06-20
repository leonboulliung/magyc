-- 015 — project_contracts: the Absegnung (sign-off) record.
--
-- One contract per project (space). Holds the reviewed contract draft, an
-- immutable snapshot of the studio conditions used, both parties' sign-offs,
-- a content hash, the generated PDF path, and an append-only audit log.
-- See docs/CONTRACT_FIELDS_SPEC.md §4.2 and docs/CONTRACT_PHASE.md.
--
-- Immutability is enforced in the API layer (reject writes when locked = true),
-- mirroring how space writes are gated server-side.
--
-- Apply manually in the Supabase SQL editor before deploying the matching app
-- changes. Idempotent.

create table if not exists project_contracts (
  space_id            text primary key references spaces(id) on delete cascade,
  parties             jsonb not null default '{}'::jsonb,   -- { photographer, client }
  condition_overrides jsonb not null default '{}'::jsonb,   -- per-project condition edits
  conditions_snapshot jsonb not null default '{}'::jsonb,   -- StudioConditions copy at draft time
  clauses             jsonb not null default '[]'::jsonb,   -- reviewed ContractDraft.sections
  draft_meta          jsonb,                                -- { model, generatedAt, gaps }
  mode                text not null default 'click',        -- 'click' | 'esign'
  esign_level         text,                                 -- 'ses' | 'aes' | 'qes'
  esign_provider_ref  text,                                 -- QTSP envelope id (later)
  status              text not null default 'draft',        -- draft|sent|owner_signed|signed|declined
  signers             jsonb not null default '[]'::jsonb,   -- [{ role, name, email, ip, ua, signedAt }]
  owner_signed_at     timestamptz,
  client_signed_at    timestamptz,
  signed_at           timestamptz,                          -- set when BOTH have signed
  content_hash        text,                                 -- sha256 of frozen clauses + parties
  pdf_path            text,                                 -- storage path of the generated PDF
  locked              boolean not null default false,       -- true once signed_at set
  audit               jsonb not null default '[]'::jsonb,   -- append-only event log
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists project_contracts_status_idx on project_contracts(status);
