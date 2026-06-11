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

export async function GET(req: Request) {
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
