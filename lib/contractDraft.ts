/**
 * ContractDraft — the structured, reviewable contract the agent produces from
 * studio conditions + project modules + parties. The owner reviews/edits this
 * before sign-off; on sign-off it is frozen into `project_contracts`.
 * See docs/CONTRACT_FIELDS_SPEC.md §3.4. Shared (client + server) types.
 */

/** Where a clause value came from — drives provenance UI + the gap list. */
export type ClauseSource = "module" | "conditions" | "client" | "generated" | "needs_input";

export interface ContractClause {
  id: string;
  label: string;
  value: string;
  source: ClauseSource;
  editable: boolean;
}

export type ContractSectionId = "dienstleister" | "kunde" | "projekt" | "konditionen" | "sonstiges";

export interface ContractSection {
  id: ContractSectionId;
  title: string;
  clauses: ContractClause[];
}

export interface ContractParties {
  photographer: {
    name: string;
    studio: string;
    email: string;
    address: string;
    vatId: string;
    kleinunternehmer19: boolean;
  };
  client: {
    name: string;
    email: string;
    address: string;
    company: string;
  };
}

export interface ContractDraft {
  language: string;
  title: string;
  parties: ContractParties;
  sections: ContractSection[];
  /** Every needs_input clause, surfaced for the owner to fill before sign-off. */
  gaps: { clauseId: string; hint: string }[];
  generatedAt: number;
  model: string;
}
