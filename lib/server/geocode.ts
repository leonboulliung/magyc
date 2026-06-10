/**
 * Geocoder — turn place names into coordinates so the map widgets
 * (location_single, locations_multi, route) can be AI-authored from a
 * plain prompt without the model ever inventing coordinates.
 *
 * Two free, keyless providers:
 *   1. Photon (Komoot) — primary. Generous, fast, no strict rate limit,
 *      returns GeoJSON [lng, lat].
 *   2. Nominatim (OpenStreetMap) — fallback. Stricter (1 req/s policy,
 *      requires a User-Agent), used only when Photon misses.
 *
 * Resolution runs on the RAW author output, before sanitisation: the
 * AI emits map widgets carrying place-name `query` fields; this module
 * geocodes them and rewrites the widgets into their real coordinate
 * shape. Widgets whose places can't be resolved are dropped (we never
 * ship a map pinned to a guessed location).
 */

interface GeoPoint {
  lng: number;
  lat: number;
}

const CACHE = new Map<string, GeoPoint | null>();

function isFiniteCoord(lng: unknown, lat: unknown): lng is number {
  return (
    typeof lng === "number" && typeof lat === "number" &&
    Number.isFinite(lng) && Number.isFinite(lat) &&
    lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
  );
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function viaPhoton(query: string): Promise<GeoPoint | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
  const json = await fetchJson(url, { accept: "application/json" });
  const feat = (json as { features?: { geometry?: { coordinates?: number[] } }[] })?.features?.[0];
  const c = feat?.geometry?.coordinates;
  if (c && isFiniteCoord(c[0], c[1])) return { lng: c[0], lat: c[1] };
  return null;
}

async function viaNominatim(query: string): Promise<GeoPoint | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const json = await fetchJson(url, {
    accept: "application/json",
    "user-agent": "magyc.site/0.1 (https://magyc.site)",
  });
  const first = Array.isArray(json) ? (json[0] as { lon?: string; lat?: string }) : null;
  if (first) {
    const lng = Number(first.lon);
    const lat = Number(first.lat);
    if (isFiniteCoord(lng, lat)) return { lng, lat };
  }
  return null;
}

/** Geocode a single place name, with cache + provider fallback. */
export async function geocode(query: string): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  if (CACHE.has(q)) return CACHE.get(q)!;
  let result = await viaPhoton(q);
  if (!result) result = await viaNominatim(q);
  CACHE.set(q, result);
  return result;
}

// ── Widget rewriting ──────────────────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** A place-bearing entry can carry a `query` (to geocode) or already a
 *  lng/lat. Returns a resolved { lng, lat, label } or null. */
async function resolvePoint(entry: unknown): Promise<{ lng: number; lat: number; label?: string } | null> {
  const r = asRecord(entry);
  if (!r) return null;
  const label = str(r.label) || str(r.query) || undefined;
  // Already has coordinates? Trust them.
  if (isFiniteCoord(r.lng, r.lat)) {
    return { lng: r.lng as number, lat: r.lat as number, label };
  }
  const query = str(r.query) || str(r.label) || str(r.name);
  if (!query) return null;
  const pt = await geocode(query);
  if (!pt) return null;
  return { lng: pt.lng, lat: pt.lat, label };
}

/**
 * Walk a raw modules array (pre-sanitisation) and resolve every map
 * widget's place names into coordinates. Returns a NEW array where:
 *   - location_single gains a real `center`, or is dropped if unresolved
 *   - locations_multi keeps only resolved locations (dropped if none)
 *   - route keeps only resolved stops (dropped if fewer than 2)
 * Non-map modules pass through untouched. Capped at MAX_GEOCODES total.
 */
const MAX_GEOCODES = 10;

export async function resolveGeocoding(rawModules: unknown[]): Promise<unknown[]> {
  let budget = MAX_GEOCODES;
  const out: unknown[] = [];

  for (const mod of rawModules) {
    const r = asRecord(mod);
    if (!r) { out.push(mod); continue; }
    const type = str(r.type);

    if (type === "location_single") {
      if (budget <= 0) continue;
      budget--;
      const query = str(r.query) || str(r.label);
      const existing = isFiniteCoord(r.center && (r.center as number[])[0], r.center && (r.center as number[])[1]);
      if (existing) { out.push(mod); continue; }
      const pt = query ? await geocode(query) : null;
      if (!pt) continue; // drop — never pin to a guess
      out.push({
        type,
        microTitle: str(r.microTitle) || undefined,
        center: [pt.lng, pt.lat],
        zoom: 13,
        label: str(r.label) || query || undefined,
      });
      continue;
    }

    if (type === "locations_multi") {
      const raw = Array.isArray(r.queries) ? r.queries : Array.isArray(r.locations) ? r.locations : [];
      const locations: { lng: number; lat: number; label?: string }[] = [];
      for (const entry of raw) {
        if (budget <= 0) break;
        budget--;
        const pt = await resolvePoint(entry);
        if (pt) locations.push(pt);
      }
      if (locations.length === 0) continue;
      out.push({ type, microTitle: str(r.microTitle) || undefined, locations });
      continue;
    }

    if (type === "route") {
      const raw = Array.isArray(r.stops) ? r.stops : Array.isArray(r.queries) ? r.queries : [];
      const stops: { lng: number; lat: number; label?: string }[] = [];
      for (const entry of raw) {
        if (budget <= 0) break;
        budget--;
        const pt = await resolvePoint(entry);
        if (pt) stops.push(pt);
      }
      if (stops.length < 2) continue; // a route needs at least two points
      out.push({ type, microTitle: str(r.microTitle) || undefined, stops });
      continue;
    }

    out.push(mod);
  }

  return out;
}
