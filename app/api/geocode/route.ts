import { NextResponse } from "next/server";
import { geocodeSearch } from "@/lib/server/geocode";

/**
 * GET /api/geocode?q=<query>
 *
 * Place-search autocomplete for the clarify location editor. Proxies
 * Photon (keyless) so the client never calls it directly and we can
 * shape/limit the response. Returns up to 5 named matches with coords.
 */
export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").slice(0, 120);
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  try {
    const results = await geocodeSearch(q, 5);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
