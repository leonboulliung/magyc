import { NextResponse } from "next/server";

/**
 * GET /api/gif?q=<query>&limit=<n>
 *
 * Proxy to Tenor v2 (TENOR_API_KEY env var) or Giphy (GIPHY_API_KEY),
 * whichever key is set — Tenor is preferred. Returns a normalised list:
 *
 *   { results: [{ id, gifUrl, thumbnailUrl, title }] }
 *
 * The client-facing search bar in GifRenderer calls this endpoint. We
 * never expose the API key to the browser.
 *
 * If neither key is configured, the endpoint returns an empty result
 * set (not an error) so the widget degrades gracefully.
 *
 * Rate limiting is left to the upstream APIs; we add a minimal server-
 * side 500ms debounce via a no-op (the client debounces its own calls).
 */

export const runtime = "edge";

const MAX_RESULTS = 12;

interface NormalisedGif {
  id: string;
  gifUrl: string;
  thumbnailUrl: string;
  title: string;
}

async function searchTenor(q: string, limit: number, key: string): Promise<NormalisedGif[]> {
  const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&limit=${limit}&key=${key}&media_filter=gif,tinygif&contentfilter=medium`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    results?: {
      id?: string;
      title?: string;
      media_formats?: { gif?: { url?: string }; tinygif?: { url?: string } };
    }[];
  };
  return (json.results || []).map((r) => ({
    id: String(r.id || ""),
    gifUrl: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || "",
    thumbnailUrl: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || "",
    title: r.title || "",
  })).filter((r) => r.gifUrl);
}

async function searchGiphy(q: string, limit: number, key: string): Promise<NormalisedGif[]> {
  const url = `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(q)}&limit=${limit}&api_key=${key}&rating=pg-13`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: {
      id?: string;
      title?: string;
      images?: {
        original?: { url?: string };
        fixed_width_downsampled?: { url?: string };
      };
    }[];
  };
  return (json.data || []).map((g) => ({
    id: String(g.id || ""),
    gifUrl: g.images?.original?.url || g.images?.fixed_width_downsampled?.url || "",
    thumbnailUrl: g.images?.fixed_width_downsampled?.url || g.images?.original?.url || "",
    title: g.title || "",
  })).filter((g) => g.gifUrl);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100);
  const limit = Math.min(MAX_RESULTS, Number.parseInt(searchParams.get("limit") || "12", 10) || 12);

  if (!q) return NextResponse.json({ results: [] });

  const tenorKey = process.env.TENOR_API_KEY;
  const giphyKey = process.env.GIPHY_API_KEY;

  if (!tenorKey && !giphyKey) {
    // No API keys configured — return empty gracefully.
    return NextResponse.json({ results: [] });
  }

  try {
    const results = tenorKey
      ? await searchTenor(q, limit, tenorKey)
      : await searchGiphy(q, limit, giphyKey!);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
