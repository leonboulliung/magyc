import { afterEach, describe, expect, it, vi } from "vitest";
import { freshSupabaseFetch } from "@/lib/supabaseTransport";

describe("Supabase transport", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries the narrow gateway clock-skew rejection", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"message":"JWT issued at future"}', { status: 401 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const pending = freshSupabaseFetch("https://example.test/rest/v1/profiles");
    await vi.runAllTimersAsync();
    const response = await pending;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry unrelated authentication failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"message":"Invalid API key"}', { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await freshSupabaseFetch("https://example.test/rest/v1/profiles");

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
