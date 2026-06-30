import { describe, expect, it } from "vitest";
import { normalizeStyle, styleVars } from "@/lib/style";
import { cleanSettings } from "@/lib/studioProfile";

describe("project style safety", () => {
  it("keeps canvas and ink deterministic while preserving an accent hue", () => {
    expect(normalizeStyle({
      font: "Inter",
      background: "#ff0000",
      color1: "#00ff00",
      color2: "#3366cc",
    })).toEqual({
      font: "Manrope",
      background: "#f4f4f1",
      color1: "#17171a",
      color2: "#3366cc",
    });
  });

  it("uses the verified light surface when no mode is supplied", () => {
    const vars = styleVars({
      font: "Inter",
      background: "#f4f4f1",
      color1: "#17171a",
      color2: "#5b7cfa",
    }, "Inter, sans-serif") as Record<string, string>;

    expect(vars["--v-page"]).toBe("#f4f4f1");
    expect(vars["--v-bg"]).toBe("#ffffff");
    expect(vars["--v-fg"]).toBe("#17171a");
    expect(vars["--v-accent"]).toBe("#5b7cfa");
  });

  it("uses an explicit, readable inverse palette in dark mode", () => {
    const vars = styleVars({
      font: "Inter",
      background: "#f4f4f1",
      color1: "#17171a",
      color2: "#5b7cfa",
    }, "Inter, sans-serif", "dark") as Record<string, string>;

    expect(vars["--v-page"]).toBe("#000000");
    expect(vars["--v-bg"]).toBe("#050505");
    expect(vars["--v-fg"]).toBe("#ffffff");
  });

  it("persists a valid account theme and defaults unknown values to light", () => {
    expect(cleanSettings({ projectTheme: "dark" }).projectTheme).toBe("dark");
    expect(cleanSettings({ projectTheme: "light" }).projectTheme).toBe("light");
    expect(cleanSettings({ projectTheme: "sepia" }).projectTheme).toBe("light");
  });
});
