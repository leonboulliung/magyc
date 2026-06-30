import type { ProjectStage } from "@/lib/types";

/** Canonical project lifecycle vocabulary shared by UI and tests. */
export const PROJECT_STAGE_LABELS: readonly { id: ProjectStage; label: string }[] = [
  { id: "brief", label: "Planung" },
  { id: "production", label: "Vertrag" },
  { id: "handoff", label: "Abgeschlossen" },
];

export const PROJECT_STAGE_ORDER: readonly ProjectStage[] = PROJECT_STAGE_LABELS.map((stage) => stage.id);
