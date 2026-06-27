import { describe, expect, it } from "vitest";
import { applyActionLocally, mergeRealtimeInsert } from "@/lib/state";
import type { ModuleStateEntry, ModuleStateKind } from "@/lib/types";

function entry(
  id: string,
  kind: ModuleStateKind,
  data: Record<string, unknown>,
  actorId = "user-a",
  moduleIndex = 2,
): ModuleStateEntry {
  return {
    id,
    spaceId: "space-a",
    moduleIndex,
    actor: { kind: "user", id: actorId },
    kind,
    data,
    createdAt: Number(id.replace(/\D/g, "")) || 1,
  };
}

describe("collaborative state semantics", () => {
  it("keeps one vote per actor and retracts it", () => {
    const first = applyActionLocally([], entry("1", "vote", { option: "A" }));
    const replaced = applyActionLocally(first, entry("2", "vote", { option: "B" }));
    expect(replaced).toHaveLength(1);
    expect(replaced[0].data.option).toBe("B");
    expect(applyActionLocally(replaced, entry("3", "vote", { option: "" }))).toEqual([]);
  });

  it("scopes checks by item and actor", () => {
    let state = applyActionLocally([], entry("1", "check", { itemKey: "one", checked: true }));
    state = applyActionLocally(state, entry("2", "check", { itemKey: "two", checked: true }));
    state = applyActionLocally(state, entry("3", "check", { itemKey: "one", checked: false }));
    expect(state.map((item) => item.data.itemKey)).toEqual(["two"]);
  });

  it("reconciles an optimistic entry with its confirmed realtime row", () => {
    const optimistic = entry("tmp_1", "add", { id: "note-1", text: "Text" });
    const confirmed = entry("db-1", "add", { id: "note-1", text: "Text" });
    const merged = mergeRealtimeInsert([optimistic], confirmed, "user-a");
    expect(merged).toEqual([confirmed]);
  });
});
