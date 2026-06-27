import { describe, expect, it } from "vitest";
import { applyPresetStateAction, cleanPresetState, removePresetModuleState } from "@/lib/presetState";

describe("preset state", () => {
  it("drops malformed and out-of-range entries", () => {
    const clean = cleanPresetState([
      { id: "ok", moduleIndex: 0, kind: "add", data: { text: "A" }, createdAt: 1 },
      { id: "bad-index", moduleIndex: 4, kind: "add", data: { text: "B" } },
      { id: "bad-kind", moduleIndex: 0, kind: "unknown", data: {} },
    ], 1);
    expect(clean).toHaveLength(1);
    expect(clean[0].id).toBe("ok");
  });

  it("keeps one active vote and supports retraction", () => {
    let state = applyPresetStateAction([], 0, "vote", { option: "A" });
    state = applyPresetStateAction(state, 0, "vote", { option: "B" });
    expect(state).toHaveLength(1);
    expect(state[0].data.option).toBe("B");
    expect(applyPresetStateAction(state, 0, "vote", { option: "" })).toEqual([]);
  });

  it("removes state for a deleted module and reindexes later modules", () => {
    const state = cleanPresetState([
      { id: "a", moduleIndex: 0, kind: "add", data: { text: "A" }, createdAt: 1 },
      { id: "b", moduleIndex: 1, kind: "add", data: { text: "B" }, createdAt: 2 },
      { id: "c", moduleIndex: 2, kind: "add", data: { text: "C" }, createdAt: 3 },
    ], 3);
    expect(removePresetModuleState(state, 1).map((entry) => [entry.id, entry.moduleIndex])).toEqual([
      ["a", 0],
      ["c", 1],
    ]);
  });
});
