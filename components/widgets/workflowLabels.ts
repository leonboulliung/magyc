"use client";

export interface WorkflowLexicon {
  planned: string;
  inProgress: string;
  ready: string;
  delivered: string;
  pending: string;
  requested: string;
  approved: string;
  assign: string;
  release: string;
  due: string;
  client: string;
  internal: string;
}

const WORKFLOW_LABELS: Record<string, WorkflowLexicon> = {
  en: {
    planned: "planned",
    inProgress: "in progress",
    ready: "ready",
    delivered: "delivered",
    pending: "pending",
    requested: "requested",
    approved: "approved",
    assign: "assign",
    release: "release",
    due: "due",
    client: "client",
    internal: "internal",
  },
  de: {
    planned: "geplant",
    inProgress: "in arbeit",
    ready: "bereit",
    delivered: "geliefert", // i18n-ignore: project-language content
    pending: "offen",
    requested: "angefragt",
    approved: "freigegeben",
    assign: "uebernehmen",
    release: "freigeben", // i18n-ignore: project-language content
    due: "faellig",
    client: "kunde", // i18n-ignore: project-language lexicon token
    internal: "intern",
  },
  fr: {
    planned: "prevu",
    inProgress: "en cours",
    ready: "pret",
    delivered: "livre",
    pending: "en attente",
    requested: "demande",
    approved: "valide",
    assign: "prendre",
    release: "liberer",
    due: "echeance",
    client: "client",
    internal: "interne",
  },
  es: {
    planned: "planificado",
    inProgress: "en curso",
    ready: "listo",
    delivered: "entregado",
    pending: "pendiente",
    requested: "pedido",
    approved: "aprobado",
    assign: "tomar",
    release: "soltar",
    due: "fecha",
    client: "cliente",
    internal: "interno",
  },
  it: {
    planned: "pianificato",
    inProgress: "in corso",
    ready: "pronto",
    delivered: "consegnato",
    pending: "in attesa",
    requested: "richiesto",
    approved: "approvato",
    assign: "prendi",
    release: "lascia",
    due: "scadenza",
    client: "cliente",
    internal: "interno",
  },
  pt: {
    planned: "planejado",
    inProgress: "em curso",
    ready: "pronto",
    delivered: "entregue",
    pending: "pendente",
    requested: "pedido",
    approved: "aprovado",
    assign: "assumir",
    release: "liberar",
    due: "prazo",
    client: "cliente",
    internal: "interno",
  },
  nl: {
    planned: "gepland",
    inProgress: "bezig",
    ready: "klaar",
    delivered: "geleverd",
    pending: "open",
    requested: "gevraagd",
    approved: "goedgekeurd",
    assign: "pakken",
    release: "loslaten",
    due: "deadline",
    client: "klant",
    internal: "intern",
  },
};

export function workflowLabels(language: string): WorkflowLexicon {
  const code = language.toLowerCase().split("-")[0];
  return WORKFLOW_LABELS[code] ?? WORKFLOW_LABELS.en;
}
