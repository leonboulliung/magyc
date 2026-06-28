import { describe, expect, it } from "vitest";
import {
  canEditProject,
  canAdvanceProject,
  canManageProject,
  canReadProject,
  isForwardStageTransition,
  resolveProjectAccessRole,
} from "@/lib/server/projectAccess";
import { canReadSpaceSnapshot } from "@/lib/server/spaceRead";

describe("project access role matrix", () => {
  it.each([
    [{ userId: "owner", ownerId: "owner", shared: false }, "owner"],
    [{ userId: "editor", ownerId: "owner", membershipRole: "editor", shared: false }, "editor"],
    [{ userId: "client", ownerId: "owner", membershipRole: "client", shared: false }, "client"],
    [{ userId: null, ownerId: "owner", shared: true }, "link"],
    [{ userId: "other", ownerId: "owner", shared: false }, "none"],
  ] as const)("resolves %o to %s", (input, expected) => {
    expect(resolveProjectAccessRole(input)).toBe(expected);
  });

  it("keeps management owner-only and editing owner/editor-only", () => {
    expect(canManageProject("owner")).toBe(true);
    expect(canManageProject("editor")).toBe(false);
    expect(canAdvanceProject("owner")).toBe(true);
    expect(canAdvanceProject("editor")).toBe(true);
    expect(canAdvanceProject("client")).toBe(false);
    expect(canEditProject("owner")).toBe(true);
    expect(canEditProject("editor")).toBe(true);
    expect(canEditProject("client")).toBe(false);
    expect(canReadProject("link")).toBe(true);
    expect(canReadProject("none")).toBe(false);
  });

  it("keeps anonymous Spaces readable but deleted projects owner-only", () => {
    expect(canReadSpaceSnapshot({ stage: null, deletedAt: null, role: "none" })).toBe(true);
    expect(canReadSpaceSnapshot({ stage: "brief", deletedAt: null, role: "client" })).toBe(true);
    expect(canReadSpaceSnapshot({ stage: "brief", deletedAt: null, role: "none" })).toBe(false);
    expect(canReadSpaceSnapshot({ stage: "handoff", deletedAt: Date.now(), role: "client" })).toBe(false);
    expect(canReadSpaceSnapshot({ stage: "handoff", deletedAt: Date.now(), role: "owner" })).toBe(true);
  });

  it("allows only the next lifecycle stage", () => {
    expect(isForwardStageTransition("brief", "production")).toBe(true);
    expect(isForwardStageTransition("production", "handoff")).toBe(true);
    expect(isForwardStageTransition("brief", "handoff")).toBe(false);
    expect(isForwardStageTransition("production", "brief")).toBe(false);
    expect(isForwardStageTransition("handoff", "handoff")).toBe(false);
  });
});
