import { describe, expect, it } from "vitest";
import { canAccessUnstagedUpload, isMimeAllowedForModule } from "@/lib/uploadPolicy";

describe("upload security", () => {
  it("restricts MIME types to upload-capable element families", () => {
    expect(isMimeAllowedForModule("images", "image/jpeg")).toBe(true);
    expect(isMimeAllowedForModule("images", "image/svg+xml")).toBe(false);
    expect(isMimeAllowedForModule("images", "application/pdf")).toBe(false);
    expect(isMimeAllowedForModule("audio", "audio/mpeg")).toBe(true);
    expect(isMimeAllowedForModule("notes", "image/jpeg")).toBe(false);
    expect(isMimeAllowedForModule("attachments", "application/pdf")).toBe(true);
  });

  it("requires the exact owner token for a private anonymous draft", async () => {
    const input = { actorUserId: null, ownerId: null, ownerAnonToken: "owner-token-123456789", visibility: null };
    expect(canAccessUnstagedUpload({ ...input, actorAnonToken: "wrong-token-123456789" })).toBe(false);
    expect(canAccessUnstagedUpload({ ...input, actorAnonToken: "owner-token-123456789" })).toBe(true);
  });

  it("keeps published non-Studio spaces collaborative", async () => {
    expect(canAccessUnstagedUpload({ actorUserId: null, actorAnonToken: "visitor-token-123456", ownerId: "owner", ownerAnonToken: null, visibility: "public" })).toBe(true);
  });
});
