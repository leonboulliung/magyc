import { describe, expect, it } from "vitest";
import { sanitizeModule } from "@/lib/modules";
import { defaultWidget, widgetPickerGroups } from "@/lib/widgetCatalog";

describe("sanitizeModule", () => {
  it("keeps empty placeholder rows for configurable workflow widgets", () => {
    // Every sanitized module now carries a generated stable id.
    const id = expect.any(String);
    expect(sanitizeModule({ type: "crew", roles: [{ name: "" }] })).toEqual({
      type: "crew",
      id,
      roles: [{ name: "" }],
    });

    expect(sanitizeModule({ type: "work_packages", packages: [{ label: "", description: "" }] })).toEqual({
      type: "work_packages",
      id,
      packages: [{ label: "" }],
    });

    expect(sanitizeModule({ type: "deliverables", items: [{ label: "", quantity: "", format: "" }] })).toEqual({
      type: "deliverables",
      id,
      items: [{ label: "" }],
    });

    expect(sanitizeModule({ type: "approvals", items: [{ text: "", audience: "client" }] })).toEqual({
      type: "approvals",
      id,
      items: [{ text: "", audience: "client" }],
    });
  });

  it("keeps intentionally empty configurable widgets without fake content", () => {
    const id = expect.any(String);
    expect(sanitizeModule({ type: "locations_multi", locations: [] })).toEqual({ type: "locations_multi", id, locations: [] });
    expect(sanitizeModule({ type: "location_suggestions", suggestions: [] })).toEqual({ type: "location_suggestions", id, suggestions: [] });
    expect(sanitizeModule({ type: "phases", phases: [], currentPhase: 0 })).toEqual({ type: "phases", id, phases: [], currentPhase: 0 });
    expect(sanitizeModule({ type: "appointments", entries: [] })).toEqual({ type: "appointments", id, entries: [] });
    expect(sanitizeModule({ type: "table", columns: [], rows: [] })).toEqual({ type: "table", id, columns: [], rows: [] });
  });

  it("assigns a stable id and preserves it across re-sanitisation", () => {
    // Every module gets an id — this is what collaborative state binds to,
    // so reordering/deleting can't leak content into the wrong element.
    const fresh = sanitizeModule({ type: "moodboard" });
    expect(fresh).not.toBeNull();
    expect(typeof fresh!.id).toBe("string");
    expect(fresh!.id!.length).toBeGreaterThan(0);

    // An existing id must survive every save unchanged (the association key
    // has to be permanent).
    const withId = sanitizeModule({ type: "parts_list", id: "keepThisId1" });
    expect(withId!.id).toBe("keepThisId1");
    expect(sanitizeModule(withId)!.id).toBe("keepThisId1");
  });

  it("can create and sanitize every element offered by the project picker", () => {
    const offered = widgetPickerGroups().flat();
    expect(offered.length).toBeGreaterThan(10);
    for (const type of offered) {
      const module = defaultWidget(type);
      expect(module, `${type} needs a default config`).not.toBeNull();
      expect(sanitizeModule(module), `${type} default must survive persistence`).not.toBeNull();
    }
  });
});
