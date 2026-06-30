import { describe, expect, it } from "vitest";
import { cleanStudioPresets, PRESET_ELEMENT_TYPES } from "@/lib/studioPresets";

describe("studio preset element policy", () => {
  it("keeps retired range and selection elements out of new presets", () => {
    expect(PRESET_ELEMENT_TYPES).not.toContain("range");
    expect(PRESET_ELEMENT_TYPES).not.toContain("selection");
  });

  it("removes retired elements from imported preset data", () => {
    const presets = cleanStudioPresets([{
      id: "legacy",
      name: "Legacy",
      modules: [
        { type: "range", unit: "generic", from: "A", to: "B" },
        { type: "selection" },
        { type: "date", date: "2026-06-30" },
      ],
      templateState: [],
      promptInjections: [],
      allowContextModules: true,
    }]);

    expect(presets?.[0]?.modules.map((module) => module.type)).toEqual(["date"]);
  });
});
