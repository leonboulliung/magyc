// Showroom stub — the modules' interactive affordances POST to this
// endpoint; we accept and discard so clicks don't 404 in the console.
// Nothing persists; the showroom is for visual exploration only.

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
