import { searchQuartiers } from "./quartiers";

export interface LocationResult {
  label: string; // primary line: name or street
  hint: string; // secondary line: city / quartier / category
  lat: number;
  lng: number;
  source: "quartier" | "photon";
}

// Komoot's Photon — free, GDPR-friendly EU geocoder built on OSM.
// No API key, no billing, generous rate limits.
const PHOTON_URL = "https://photon.komoot.io/api/";
// Bounding box covers Paris + the three petite-couronne départements
// (Hauts-de-Seine, Seine-Saint-Denis, Val-de-Marne) — so Nanterre,
// Boulogne, Ivry, Saint-Denis, Montreuil etc. resolve, but the rest of
// France stays out. `lat`/`lon` below bias Paris centre so closer
// matches still rank first inside that box.
const PARIS_BBOX = "2.02,48.69,2.62,48.99";
const PARIS_CENTER = { lat: 48.8566, lng: 2.3522 };

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    suburb?: string;
    locality?: string;
    osm_value?: string;
    osm_key?: string;
    type?: string;
    countrycode?: string;
  };
};

function rankBadge(props: NonNullable<PhotonFeature["properties"]>): string {
  const v = props.osm_value;
  // Pretty-print common venue types
  const map: Record<string, string> = {
    bar: "BAR",
    cafe: "CAFÉ",
    restaurant: "RESTAURANT",
    cinema: "CINÉMA",
    theatre: "THÉÂTRE",
    library: "BIBLIO",
    bookshop: "LIVRES",
    books: "LIVRES",
    nightclub: "CLUB",
    gallery: "GALERIE",
    museum: "MUSÉE",
    park: "PARC",
    square: "PLACE",
    fountain: "FONTAINE",
    bakery: "BOULANGERIE",
    music_venue: "MUSIQUE",
    arts_centre: "ARTS",
  };
  if (v && map[v]) return map[v];
  if (v && v !== "yes" && v.length < 16) return v.toUpperCase();
  return "";
}

export async function searchLocations(q: string, signal?: AbortSignal): Promise<LocationResult[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];

  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", "10");
  url.searchParams.set("bbox", PARIS_BBOX);
  url.searchParams.set("lang", "fr");
  url.searchParams.set("lat", String(PARIS_CENTER.lat));
  url.searchParams.set("lon", String(PARIS_CENTER.lng));

  try {
    const res = await fetch(url.toString(), { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const features = data.features || [];
    return features
      .filter(
        (f) =>
          f.geometry?.coordinates?.length === 2 &&
          (f.properties?.countrycode === "FR" || !f.properties?.countrycode),
      )
      .map((f): LocationResult => {
        const [lng, lat] = f.geometry!.coordinates!;
        const p = f.properties || {};
        const label =
          p.name ||
          [p.housenumber, p.street].filter(Boolean).join(" ") ||
          p.locality ||
          "Pin";
        const venueTag = rankBadge(p);
        const place = p.district || p.suburb || p.locality || p.city || "Paris";
        const hint = [venueTag, place].filter(Boolean).join(" · ");
        return { label, hint, lat, lng, source: "photon" };
      });
  } catch {
    return [];
  }
}

/**
 * Combined search: instant local quartier matches first, then live Photon
 * matches (shops, addresses, venues). Deduped by label.
 */
export async function combinedSearch(q: string, signal?: AbortSignal): Promise<LocationResult[]> {
  const local: LocationResult[] = searchQuartiers(q, 4).map((qu) => ({
    label: qu.name,
    hint: qu.arr || "QUARTIER",
    lat: qu.lat,
    lng: qu.lng,
    source: "quartier",
  }));
  const remote = await searchLocations(q, signal);
  const seen = new Set(local.map((l) => l.label.toLowerCase()));
  const deduped = remote.filter((r) => !seen.has(r.label.toLowerCase()));
  return [...local, ...deduped].slice(0, 10);
}
