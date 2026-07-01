import { describe, expect, it } from "vitest";
import { sanitizeModule } from "@/lib/modules";

describe("sanitizeModule", () => {
  it("keeps empty placeholder rows for configurable workflow widgets", () => {
    expect(sanitizeModule({ type: "crew", roles: [{ name: "" }] })).toEqual({
      type: "crew",
      roles: [{ name: "" }],
    });

    expect(sanitizeModule({ type: "work_packages", packages: [{ label: "", description: "" }] })).toEqual({
      type: "work_packages",
      packages: [{ label: "" }],
    });

    expect(sanitizeModule({ type: "deliverables", items: [{ label: "", quantity: "", format: "" }] })).toEqual({
      type: "deliverables",
      items: [{ label: "" }],
    });

    expect(sanitizeModule({ type: "approvals", items: [{ text: "", audience: "client" }] })).toEqual({
      type: "approvals",
      items: [{ text: "", audience: "client" }],
    });
  });

  it("keeps intentionally empty configurable widgets without fake content", () => {
    expect(sanitizeModule({ type: "locations_multi", locations: [] })).toEqual({ type: "locations_multi", locations: [] });
    expect(sanitizeModule({ type: "location_suggestions", suggestions: [] })).toEqual({ type: "location_suggestions", suggestions: [] });
    expect(sanitizeModule({ type: "phases", phases: [], currentPhase: 0 })).toEqual({ type: "phases", phases: [], currentPhase: 0 });
    expect(sanitizeModule({ type: "appointments", entries: [] })).toEqual({ type: "appointments", entries: [] });
    expect(sanitizeModule({ type: "table", columns: [], rows: [] })).toEqual({ type: "table", columns: [], rows: [] });
  });
});
