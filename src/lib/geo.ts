// Géocodage via Nominatim (OpenStreetMap) — service public gratuit.
// Appelé uniquement sur action explicite de l'utilisateur (bouton « Localiser »),
// jamais automatiquement : l'adresse est envoyée à openstreetmap.org.

export interface GeoPoint {
  lat: number;
  lng: number;
}

let lastCall = 0;

/** Géocode une adresse ou une ville. Limité à 1 requête/seconde (politique Nominatim). */
export async function geocode(query: string): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  const wait = Math.max(0, lastCall + 1100 - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr,be,ch,lu&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const js: { lat: string; lon: string }[] = await res.json();
    if (!js.length) return null;
    return { lat: Number(js[0].lat), lng: Number(js[0].lon) };
  } catch {
    return null;
  }
}
