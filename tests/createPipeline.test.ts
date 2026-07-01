import { describe, expect, it } from "vitest";
import { mergeSeededModules, withClarifyAnswer, workflowRules } from "@/lib/createPipeline";
import type { Module } from "@/lib/types";

describe("creation pipeline", () => {
  it("lets the current clarification override the same preset element type", () => {
    const preset = [{ type: "locations_multi", locations: [] }] as Module[];
    const clarified = [{ type: "locations_multi", locations: [{ lng: 13.4, lat: 52.5, label: "Studio Berlin" }] }] as Module[];
    const merged = mergeSeededModules(preset, clarified);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(clarified[0]);
  });

  it("keeps workflow rules independent, clean and bounded", () => {
    expect(workflowRules(["  Immer   Backup einplanen.  ", ""], ["Immer Backup einplanen.", "Kunde freigeben lassen."]))
      .toEqual(["Immer Backup einplanen.", "Kunde freigeben lassen."]);
  });

  it("removes a custom clarification answer when the user clears it", () => {
    expect(withClarifyAnswer({ s1: "Studio" }, "s1", "   ")).toEqual({});
    expect(withClarifyAnswer({}, "s1", "  Berlin  ")).toEqual({ s1: "Berlin" });
  });
});
