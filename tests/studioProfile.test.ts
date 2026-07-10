import { describe, expect, it } from "vitest";
import { cleanSettings, LANGUAGE_OPTIONS } from "@/lib/studioProfile";

describe("studio profile language settings", () => {
  it("only exposes fully supported account languages", () => {
    expect(LANGUAGE_OPTIONS.map((option) => option.value)).toEqual(["de", "en"]);
  });

  it("normalizes legacy or unsupported saved languages", () => {
    expect(cleanSettings({ defaultLanguage: "en-US" }).defaultLanguage).toBe("en");
    expect(cleanSettings({ defaultLanguage: "fr" }).defaultLanguage).toBe("de");
    expect(cleanSettings({ defaultLanguage: null }).defaultLanguage).toBe("de");
  });
});
