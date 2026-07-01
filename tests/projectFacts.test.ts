import { describe, expect, it } from "vitest";
import { buildProjectFacts } from "@/lib/projectFacts";
import type { Module, ModuleStateEntry, ModuleStateKind } from "@/lib/types";

function state(
  id: string,
  moduleIndex: number,
  kind: ModuleStateKind,
  data: Record<string, unknown>,
  createdAt: number,
): ModuleStateEntry {
  return {
    id,
    spaceId: "space-a",
    moduleIndex,
    actor: { kind: "user", id: "owner", displayName: "Owner" },
    kind,
    data,
    createdAt,
  };
}

describe("buildProjectFacts", () => {
  it("projects edited notes and omits deleted notes", () => {
    const modules = [{ type: "notes", microTitle: "Notizen" }] as unknown as Module[];
    const facts = buildProjectFacts(modules, [
      state("add-1", 0, "add", { id: "n-1", text: "Alt" }, 1),
      state("edit-1", 0, "edit", { id: "n-1", text: "Neu" }, 2),
      state("add-2", 0, "add", { id: "n-2", text: "Weg" }, 3),
      state("edit-2", 0, "edit", { id: "n-2", deleted: true }, 4),
    ]);
    expect(facts.notes).toEqual(["Neu"]);
  });

  it("applies edits and deletions to added equipment", () => {
    const modules = [{ type: "parts_list", microTitle: "Utensilien", items: [] }] as unknown as Module[];
    const facts = buildProjectFacts(modules, [
      state("add-1", 0, "add", { id: "p-1", name: "Kamera", quantity: "1" }, 1),
      state("edit-1", 0, "edit", { id: "p-1", quantity: "2" }, 2),
      state("add-2", 0, "add", { id: "p-2", name: "Stativ" }, 3),
      state("edit-2", 0, "edit", { id: "p-2", deleted: true }, 4),
    ]);
    expect(facts.parts).toEqual([{ name: "Kamera", quantity: "2", imageUrl: undefined }]);
  });

  it("does not expose removed uploads to contracts or completion summaries", () => {
    const modules = [{ type: "attachments", microTitle: "Anhänge" }] as unknown as Module[];
    const facts = buildProjectFacts(modules, [
      state("upload-1", 0, "upload", { name: "brief.pdf", mimeType: "application/pdf", size: 1200 }, 1),
      state("delete-1", 0, "edit", { id: "upload-1", deleted: true }, 2),
      state("upload-2", 0, "upload", { name: "final.jpg", mimeType: "image/jpeg", size: 2400 }, 3),
    ]);
    expect(facts.uploads).toEqual([
      { name: "final.jpg", mimeType: "image/jpeg", size: 2400, moduleType: "attachments" },
    ]);
  });

  it("merges successive partial edits into a complete deliverable", () => {
    const modules = [{
      type: "deliverables",
      microTitle: "Ergebnisse",
      items: [{ label: "Hero-Bild", quantity: "1", status: "planned" }],
    }] as unknown as Module[];
    const facts = buildProjectFacts(modules, [
      state("edit-1", 0, "edit", { id: "seed-0", status: "ready", quantity: "3", format: "TIFF", details: "Retuschiert" }, 1),
      state("edit-2", 0, "edit", { id: "seed-0", due: "Freitag", details: "" }, 2),
    ]);
    expect(facts.deliverables[0]).toMatchObject({ label: "Hero-Bild", status: "ready", due: "Freitag", quantity: "3", format: "TIFF", details: undefined });
  });

  it("keeps suggestions out of confirmed contract locations", () => {
    const modules = [
      { type: "location_suggestions", suggestions: [{ label: "Vielleicht Studio A", address: "Berlin" }] },
      { type: "locations_multi", locations: [{ lng: 13.4, lat: 52.5, label: "Bestätigtes Studio" }] },
    ] as unknown as Module[];
    expect(buildProjectFacts(modules).locations).toEqual(["Bestätigtes Studio"]);
  });

  it("uses only each actor's latest poll vote and includes moodboard media", () => {
    const modules = [
      { type: "poll", question: "Look?", options: ["A", "B"] },
      { type: "moodboard", directions: [] },
    ] as unknown as Module[];
    const voteA = state("vote-a", 0, "vote", { option: "A" }, 1);
    const voteB = { ...state("vote-b", 0, "vote", { option: "B" }, 2), actor: voteA.actor };
    const facts = buildProjectFacts(modules, [
      voteA,
      voteB,
      state("mood-img", 1, "upload", { name: "look.jpg", mimeType: "image/jpeg", size: 900 }, 3),
    ]);
    expect(facts.polls[0].options).toEqual([{ label: "A", votes: 0 }, { label: "B", votes: 1 }]);
    expect(facts.uploads).toContainEqual({ name: "look.jpg", mimeType: "image/jpeg", size: 900, moduleType: "moodboard" });
  });
});
