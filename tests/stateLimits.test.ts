import { describe, expect, it } from "vitest";
import { APPEND_STATE_LIMITS, appendStateLimit } from "@/lib/server/stateLimits";

describe("state capacity policy", () => {
  it("caps append-only kinds", () => {
    expect(appendStateLimit("voice")).toBe(APPEND_STATE_LIMITS.voice);
    expect(appendStateLimit("add")).toBe(APPEND_STATE_LIMITS.add);
    expect(appendStateLimit("upload")).toBe(APPEND_STATE_LIMITS.upload);
    expect(appendStateLimit("stroke")).toBe(APPEND_STATE_LIMITS.stroke);
  });

  it("does not cap replacement kinds through append policy", () => {
    expect(appendStateLimit("vote")).toBeNull();
    expect(appendStateLimit("check")).toBeNull();
    expect(appendStateLimit("claim")).toBeNull();
    expect(appendStateLimit("edit")).toBeNull();
  });
});
