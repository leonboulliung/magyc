import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCompletion } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createCompletion } };
  },
}));

import { clarifyInput } from "@/lib/server/clarify";
import { classifyInput } from "@/lib/server/classify";

function completion(payload: Record<string, unknown>) {
  return {
    choices: [{ message: { content: JSON.stringify(payload) } }],
  };
}

function photographyScores(): Record<string, number> {
  return {
    ai_summary: 1,
    date: 0,
    appointment: 0,
    appointments: 0,
    range: 0,
    phases: 0,
    location_single: 0,
    locations_multi: 0,
    location_suggestions: 0,
    route: 0,
    crew: 5,
    work_packages: 2,
    deliverables: 6,
    checklist: 7,
    notes: 0,
    qa: 0,
    poll: 0,
    approvals: 2,
    table: 0,
    shot_list: 9,
    parts_list: 0,
    attachments: 0,
    images: 0,
    moodboard: 8,
    audio: 0,
    sketch: 0,
  };
}

describe("photography prompt boundary", () => {
  beforeEach(() => {
    createCompletion.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("rejects unrelated input at the clarification boundary", async () => {
    createCompletion.mockResolvedValueOnce(completion({
      domainFit: false,
      language: "de",
      steps: [],
    }));

    await expect(clarifyInput("Gib mir ein Pfannkuchen-Rezept", { language: "de" }))
      .rejects.toThrow("input_not_photography_project");

    const request = createCompletion.mock.calls[0][0];
    expect(request.messages[0].content).toContain("collaborative professional photography");
    expect(request.messages[0].content).toContain("Set \"domainFit\" to false for unrelated requests");
    expect(request.messages[1].content).toContain("Gib mir ein Pfannkuchen-Rezept");
  });

  it("keeps the configured language even when the model claims another", async () => {
    createCompletion.mockResolvedValueOnce(completion({
      domainFit: true,
      language: "en",
      comingToLife: "Das Produktshooting nimmt Form an.",
      steps: [{
        id: "ignored",
        kind: "choice",
        category: "general",
        text: "Welche Bildwirkung ist gewünscht?",
        options: [{ value: "Warm" }, { value: "Klar" }],
      }],
    }));

    const result = await clarifyInput("A product shoot in Berlin", { language: "de" });

    expect(result.language).toBe("de");
    expect(result.steps[0]).toMatchObject({ id: "s1", text: "Welche Bildwirkung ist gewünscht?" });
    expect(createCompletion.mock.calls[0][0].messages[0].content).toContain("fixed output language (de)");
  });

  it("applies the same domain and language boundary to project authoring", async () => {
    createCompletion
      .mockResolvedValueOnce(completion({
        domainFit: true,
        language: "en",
        title: "Produktfotografie in Berlin",
        vibe: "minimal",
        scores: photographyScores(),
        explicit: [],
      }))
      .mockResolvedValueOnce(completion({
        richText: { type: "rich_text", microTitle: "Konzept", text: "Eine klare Produktserie." },
        tags: { type: "tags", tags: ["Produkt", "Berlin"] },
        body: [
          { type: "shot_list", microTitle: "Shotlist", description: "Geplante Motive", shots: [] },
          { type: "moodboard", microTitle: "Bildsprache", description: "Visuelle Richtung", directions: [] },
          { type: "checklist", microTitle: "Vorbereitung", description: "Vor dem Set", items: [] },
          { type: "deliverables", microTitle: "Ergebnisse", description: "Lieferumfang", items: [] },
          { type: "crew", microTitle: "Team", description: "Beteiligte Rollen", roles: [] },
        ],
        labels: {},
        style: { font: "Inter", color1: "#17171a", color2: "#5b7cfa", background: "#f4f4f1" },
      }));

    const result = await classifyInput("Product photography in Berlin", [], [], {
      language: "de",
      workflowRules: ["Immer eine Kund:innenfreigabe einplanen."],
    });

    expect(result.language).toBe("de");
    expect(result.title).toBe("Produktfotografie in Berlin");
    expect(createCompletion).toHaveBeenCalledTimes(2);
    expect(createCompletion.mock.calls[0][0].messages[0].content).toContain("fixed output language is German (de)");
    expect(createCompletion.mock.calls[1][0].messages[0].content).toContain("OUTPUT LANGUAGE: German (code: de)");
    expect(createCompletion.mock.calls[0][0].messages[1].content).toContain("WORKFLOW RULES");
    expect(createCompletion.mock.calls[1][0].messages[1].content).toContain("Immer eine Kund:innenfreigabe einplanen.");
  });

  it("never reaches authoring when analysis rejects the domain", async () => {
    createCompletion.mockResolvedValueOnce(completion({
      domainFit: false,
      language: "de",
      scores: photographyScores(),
    }));

    await expect(classifyInput("Schreibe TypeScript-Code", [], [], { language: "de" }))
      .rejects.toThrow("input_not_photography_project");
    expect(createCompletion).toHaveBeenCalledTimes(1);
  });
});
