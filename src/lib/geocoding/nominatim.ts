import 'server-only';

export interface GeoPoint {
  lat: number;
  lng: number;
}

// Nominatim's usage policy caps unauthenticated use at 1 request/second and
// requires a descriptive User-Agent. Module-level state is a best-effort
// throttle for calls issued within the same server invocation (geocoding
// the atelier + a customer address back-to-back); it isn't a guarantee
// across concurrent serverless instances, so keep call volume low and rely
// on cep_cache to avoid re-geocoding the same address.
let lastCallAt = 0;

async function throttle() {
  const minGapMs = 1100;
  const wait = lastCallAt + minGapMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

/** Geocodes a free-text address (e.g. "Rua X, 100 - Bairro, Cidade - UF, Brasil") via Nominatim. */
export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  await throttle();

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'br');

  const res = await fetch(url, {
    headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || 'FloreAtelie/1.0' },
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

/** Great-circle distance between two points, in kilometers. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
