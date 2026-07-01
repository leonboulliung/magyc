import { describe, expect, it } from "vitest";
import { cleanStudioPresets, PRESET_ELEMENT_TYPES } from "@/lib/studioPresets";

describe("studio preset element policy", () => {
  it("keeps retired range and selection elements out of new presets", () => {
    expect(PRESET_ELEMENT_TYPES).not.toContain("range");
    expect(PRESET_ELEMENT_TYPES).not.toContain("selection");
    expect(PRESET_ELEMENT_TYPES).not.toContain("location_single");
    expect(PRESET_ELEMENT_TYPES).not.toContain("route");
    expect(PRESET_ELEMENT_TYPES).toContain("locations_multi");
  });

  it("migrates historic single-place and route presets into one places element", () => {
    const presets = cleanStudioPresets([{
      id: "maps",
      name: "Maps",
      modules: [
        { type: "location_single", center: [13.4, 52.5], label: "Studio" },
        { type: "route", stops: [{ lng: 13.4, lat: 52.5, label: "A" }, { lng: 13.5, lat: 52.6, label: "B" }] },
      ],
      templateState: [],
      promptInjections: [],
      allowContextModules: true,
    }]);

    expect(presets?.[0]?.modules).toHaveLength(1);
    expect(presets?.[0]?.modules[0]).toMatchObject({ type: "locations_multi", locations: expect.arrayContaining([
      expect.objectContaining({ label: "Studio" }),
      expect.objectContaining({ label: "A" }),
      expect.objectContaining({ label: "B" }),
    ]) });
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
