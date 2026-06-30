const CLOCK_SKEW_RETRY_DELAYS_MS = [250, 750, 1_500] as const;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Always-fresh transport for supabase-js. Next.js patches global fetch and may
 * otherwise cache mutable REST reads. A narrow retry also absorbs the brief
 * gateway/PostgREST clock skew that returns `JWT issued at future` before a
 * request has been executed.
 */
export const freshSupabaseFetch: typeof fetch = async (input, init) => {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(input, { ...init, cache: "no-store" });
    if (response.status !== 401 || attempt >= CLOCK_SKEW_RETRY_DELAYS_MS.length) {
      return response;
    }

    const body = await response.clone().text().catch(() => "");
    if (!/jwt issued at future/i.test(body)) return response;
    await wait(CLOCK_SKEW_RETRY_DELAYS_MS[attempt]);
  }
};
