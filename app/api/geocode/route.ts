import { NextResponse } from "next/server";
import { geocodeSearch, reverseGeocode } from "@/lib/server/geocode";

/**
 * GET /api/geocode?q=<query>           → { results: GeoMatch[] }
 * GET /api/geocode?lat=<n>&lng=<n>     → { label: string | null }
 *
 * Place-search autocomplete (forward) for the location editor, and
 * reverse lookup so a dragged pin can relabel itself. Proxies Photon
 * (keyless) so the client never calls it directly.
 */
export const runtime = "edge";

// Lightweight per-IP burst guard for this public, keyless proxy. Generous
// enough to never interrupt debounced autocomplete typing, but it caps a
// single source hammering the endpoint (abuse / function-invocation DoS).
// Per-isolate in-memory — a basic guard, not a distributed quota.
const HITS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

function rateLimited(req: Request): boolean {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const entry = HITS.get(ip);
  if (!entry || now > entry.resetAt) {
    HITS.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (HITS.size > 5_000) for (const [k, v] of HITS) if (now > v.resetAt) HITS.delete(k);
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function GET(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ results: [], label: null }, { status: 429 });
  }
  const { searchParams } = new URL(req.url);

  // Reverse mode: coordinates → place label.
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  if (latRaw !== null && lngRaw !== null) {
    const lat = Number.parseFloat(latRaw);
    const lng = Number.parseFloat(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ label: null });
    }
    try {
      const label = await reverseGeocode(lng, lat);
      return NextResponse.json({ label });
    } catch {
      return NextResponse.json({ label: null });
    }
  }

  // Forward mode: query → matches.
  const q = (searchParams.get("q") || "").slice(0, 120);
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  try {
    const results = await geocodeSearch(q, 5);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
