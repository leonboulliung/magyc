import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "@/lib/client/errors";

describe("API error copy", () => {
  it("maps infrastructure errors to actionable German copy", () => {
    expect(apiErrorMessage({ error: "state_limit_reached" })).toContain("Element");
    expect(apiErrorMessage({ error: "asset_delete_failed" })).toContain("Datei");
    expect(apiErrorMessage({ error: "mime_not_allowed" })).toContain("Dateityp");
    expect(apiErrorMessage({ error: "contract_conflict" })).toContain("neu laden");
  });

  it("prefers a concrete detail but keeps a fallback for empty payloads", () => {
    expect(apiErrorMessage({ error: "upload_failed", detail: "Konkreter Fehler" })).toBe("Konkreter Fehler");
    expect(apiErrorMessage({}, "Fallback")).toBe("Fallback");
  });
});
