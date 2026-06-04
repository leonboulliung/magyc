/**
 * Pretty-print a Photon osm_value into a short, mono-style chip label.
 * Returns null when the input is empty, unknown, or "yes".
 */
const LABELS: Record<string, string> = {
  bar: "BAR",
  pub: "PUB",
  cafe: "CAFÉ",
  restaurant: "RESTAURANT",
  fast_food: "FAST FOOD",
  food_court: "FOOD COURT",
  bakery: "BOULANGERIE",
  ice_cream: "GLACIER",
  cinema: "CINÉMA",
  theatre: "THÉÂTRE",
  arts_centre: "ARTS",
  community_centre: "CENTRE",
  music_venue: "MUSIQUE",
  nightclub: "CLUB",
  gallery: "GALERIE",
  museum: "MUSÉE",
  library: "BIBLIO",
  bookshop: "LIVRES",
  books: "LIVRES",
  park: "PARC",
  garden: "JARDIN",
  square: "PLACE",
  fountain: "FONTAINE",
  beach: "PLAGE",
  swimming_pool: "PISCINE",
  university: "UNIVERSITÉ",
  college: "COLLÈGE",
  school: "ÉCOLE",
  studio: "STUDIO",
  coworking_space: "COWORKING",
  marketplace: "MARCHÉ",
  market: "MARCHÉ",
  bridge: "PONT",
  viewpoint: "POINT DE VUE",
  hotel: "HÔTEL",
  hostel: "AUBERGE",
};

export function placeKindLabel(kind: string | null | undefined): string | null {
  if (!kind) return null;
  const k = kind.trim().toLowerCase();
  if (!k || k === "yes") return null;
  if (LABELS[k]) return LABELS[k];
  if (k.length >= 16) return null;
  return k.replace(/_/g, " ").toUpperCase();
}
