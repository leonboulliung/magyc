import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSpaceSnapshot, fetchVersionSnapshot } from "@/lib/client/spaceRead";
import type { Space } from "@/lib/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authorized client snapshot reads", () => {
  it("returns a server-authorized Space snapshot", async () => {
    const space = { id: "space-a", title: "Projekt" } as Space;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ space }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSpaceSnapshot("space-a")).resolves.toEqual(space);
    expect(fetchMock).toHaveBeenCalledWith("/api/spaces/space-a", {
      cache: "no-store",
      credentials: "same-origin",
    });
  });

  it("does not distinguish missing and forbidden projects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "not_found" }),
      { status: 404 },
    )));
    await expect(fetchSpaceSnapshot("private-space")).resolves.toBeNull();
  });

  it("reads historical modules through the scoped API", async () => {
    const modules = [{ type: "heading", microTitle: "Titel", text: "Alt" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ modules }),
      { status: 200 },
    )));
    await expect(fetchVersionSnapshot("space-a", 2)).resolves.toEqual(modules);
  });
});
