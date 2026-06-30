import { describe, expect, it } from "vitest";
import { PROJECT_STAGE_LABELS, PROJECT_STAGE_ORDER } from "@/lib/projectStages";

describe("project lifecycle labels", () => {
  it("uses the approved three-phase vocabulary", () => {
    expect(PROJECT_STAGE_LABELS).toEqual([
      { id: "brief", label: "Planung" },
      { id: "production", label: "Vertrag" },
      { id: "handoff", label: "Abgeschlossen" },
    ]);
    expect(PROJECT_STAGE_ORDER).toEqual(["brief", "production", "handoff"]);
  });
});
