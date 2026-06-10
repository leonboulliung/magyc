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
  const timer = setTimeout(() => controller.abort(), 2500);
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

export interface GeoMatch {
  label: string;
  lng: number;
  lat: number;
}

/** Compose a readable label from a Photon feature's properties. */
function photonLabel(props: Record<string, unknown>): string {
  const parts = [props.name, props.street, props.city, props.state, props.country]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  // De-dup consecutive equal parts (name often equals city for cities).
  const out: string[] = [];
  for (const p of parts) if (out[out.length - 1] !== p) out.push(p);
  return out.slice(0, 3).join(", ");
}

/**
 * Search for places matching a query — the autocomplete behind the
 * clarify location editor. Returns up to `limit` named matches with
 * coordinates. Photon only (keyless, generous); no Nominatim fallback
 * here to keep typing fast.
 */
export async function geocodeSearch(query: string, limit = 5): Promise<GeoMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}`;
  const json = await fetchJson(url, { accept: "application/json" });
  const feats = (json as { features?: { geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }[] })?.features;
  if (!Array.isArray(feats)) return [];
  const out: GeoMatch[] = [];
  for (const f of feats) {
    const c = f.geometry?.coordinates;
    if (!c || !isFiniteCoord(c[0], c[1])) continue;
    const label = photonLabel(f.properties ?? {});
    if (!label) continue;
    out.push({ label, lng: c[0], lat: c[1] });
  }
  return out;
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

/** Pull the geocode query from a place entry, or null if it already
 *  has trusted coordinates / nothing to resolve. */
function entryQuery(entry: unknown): { query: string | null; coords: { lng: number; lat: number } | null; label?: string } {
  const r = asRecord(entry);
  if (!r) return { query: null, coords: null };
  const label = str(r.label) || str(r.query) || undefined;
  if (isFiniteCoord(r.lng, r.lat)) {
    return { query: null, coords: { lng: r.lng as number, lat: r.lat as number }, label };
  }
  const query = str(r.query) || str(r.label) || str(r.name);
  return { query: query || null, coords: null, label };
}

/**
 * Walk a raw modules array (pre-sanitisation) and resolve every map
 * widget's place names into coordinates. ALL geocode lookups across the
 * whole space run in PARALLEL (Photon has no strict rate limit), so a
 * route with several stops costs ~one request-time, not N × it — this
 * is what keeps space creation under the serverless timeout.
 *
 *   - location_single gains a real `center`, or is dropped if unresolved
 *   - locations_multi keeps only resolved locations (dropped if none)
 *   - route keeps only resolved stops (dropped if fewer than 2)
 * Non-map modules pass through untouched. Capped at MAX_GEOCODES total.
 */
const MAX_GEOCODES = 8;
const MAP_TYPES = new Set(["location_single", "locations_multi", "route"]);

export async function resolveGeocoding(rawModules: unknown[]): Promise<unknown[]> {
  // Pass 1 — collect every unique query the space needs, up to budget.
  const queries = new Set<string>();
  for (const mod of rawModules) {
    const r = asRecord(mod);
    if (!r || !MAP_TYPES.has(str(r.type))) continue;
    const type = str(r.type);
    if (type === "location_single") {
      const q = str(r.query) || str(r.label);
      const has = isFiniteCoord(r.center && (r.center as number[])[0], r.center && (r.center as number[])[1]);
      if (q && !has) queries.add(q);
    } else {
      const arr = Array.isArray(r.queries) ? r.queries
        : Array.isArray(r.stops) ? r.stops
        : Array.isArray(r.locations) ? r.locations : [];
      for (const entry of arr) {
        const { query } = entryQuery(entry);
        if (query) queries.add(query);
      }
    }
    if (queries.size >= MAX_GEOCODES) break;
  }

  // Pass 2 — resolve them all in parallel; results land in the cache.
  const list = [...queries].slice(0, MAX_GEOCODES);
  await Promise.all(list.map((q) => geocode(q)));

  // Synchronous cache reader (every needed query is now cached).
  const lookup = (q: string | null): GeoPoint | null =>
    q ? (CACHE.get(q) ?? null) : null;

  // Pass 3 — rebuild the modules using resolved coordinates.
  const out: unknown[] = [];
  for (const mod of rawModules) {
    const r = asRecord(mod);
    if (!r) { out.push(mod); continue; }
    const type = str(r.type);

    if (type === "location_single") {
      const has = isFiniteCoord(r.center && (r.center as number[])[0], r.center && (r.center as number[])[1]);
      if (has) { out.push(mod); continue; }
      const query = str(r.query) || str(r.label);
      const pt = lookup(query);
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
      const arr = Array.isArray(r.queries) ? r.queries : Array.isArray(r.locations) ? r.locations : [];
      const locations: { lng: number; lat: number; label?: string }[] = [];
      for (const entry of arr) {
        const { query, coords, label } = entryQuery(entry);
        const pt = coords ?? lookup(query);
        if (pt) locations.push({ lng: pt.lng, lat: pt.lat, label });
      }
      if (locations.length === 0) continue;
      out.push({ type, microTitle: str(r.microTitle) || undefined, locations });
      continue;
    }

    if (type === "route") {
      const arr = Array.isArray(r.stops) ? r.stops : Array.isArray(r.queries) ? r.queries : [];
      const stops: { lng: number; lat: number; label?: string }[] = [];
      for (const entry of arr) {
        const { query, coords, label } = entryQuery(entry);
        const pt = coords ?? lookup(query);
        if (pt) stops.push({ lng: pt.lng, lat: pt.lat, label });
      }
      if (stops.length < 2) continue;
      out.push({ type, microTitle: str(r.microTitle) || undefined, stops });
      continue;
    }

    out.push(mod);
  }

  return out;
}
