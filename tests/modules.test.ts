import { describe, expect, it } from "vitest";
import { sanitizeModule } from "@/lib/modules";

describe("sanitizeModule", () => {
  it("keeps empty placeholder rows for configurable workflow widgets", () => {
    expect(sanitizeModule({ type: "crew", roles: [{ name: "" }] })).toEqual({
      type: "crew",
      roles: [{ name: "" }],
    });

    expect(sanitizeModule({ type: "work_packages", packages: [{ label: "", description: "" }] })).toEqual({
      type: "work_packages",
      packages: [{ label: "" }],
    });

    expect(sanitizeModule({ type: "deliverables", items: [{ label: "", quantity: "", format: "" }] })).toEqual({
      type: "deliverables",
      items: [{ label: "" }],
    });

    expect(sanitizeModule({ type: "approvals", items: [{ text: "", audience: "client" }] })).toEqual({
      type: "approvals",
      items: [{ text: "", audience: "client" }],
    });
  });
});
