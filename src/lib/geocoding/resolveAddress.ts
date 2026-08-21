import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchViaCep } from './viacep';
import { geocodeAddress, haversineKm, type GeoPoint } from './nominatim';
import { computeShippingFee, type ShippingFormula } from './shipping';

/**
 * Returns (and caches in `settings.atelier_coords`) the atelier's own
 * lat/lng, geocoded once from ATELIER_ADDRESS. Every shipping-distance
 * calculation is relative to this point.
 */
async function getAtelierCoords(): Promise<GeoPoint | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('settings').select('value').eq('key', 'atelier_coords').maybeSingle();
  if (data?.value) return data.value as GeoPoint;

  const address = process.env.ATELIER_ADDRESS;
  if (!address) return null;

  const point = await geocodeAddress(address);
  if (!point) return null;

  await admin.from('settings').upsert({ key: 'atelier_coords', value: point });
  return point;
}

// Launch area: São Paulo state only. Deliveries are hand-carried from the
// atelier, so anywhere we can't reasonably reach isn't served yet — kept as
// a list (not a single string) so widening the launch area later is a
// one-line change here, not a hunt through every call site.
export const SERVED_STATES = ['SP'];

export interface ResolvedAddress {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  distanceKm: number | null;
  shippingFee: number | null;
  /** False when the CEP resolves fine but sits outside SERVED_STATES. */
  served: boolean;
}

/**
 * Full CEP -> address + shipping-distance resolution, backed by cep_cache
 * so repeat lookups (and Nominatim's 1 req/s policy) stay cheap.
 */
export async function resolveAddress(cep: string): Promise<ResolvedAddress | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  const admin = createAdminClient();
  const { data: cached } = await admin.from('cep_cache').select('*').eq('cep', digits).maybeSingle();

  let street = cached?.street ?? '';
  let neighborhood = cached?.neighborhood ?? '';
  let city = cached?.city ?? '';
  let state = cached?.state ?? '';
  let distanceKm = cached?.distance_km ?? null;
  let lat = cached?.lat ?? null;
  let lng = cached?.lng ?? null;

  if (!cached || !cached.street) {
    const viaCep = await fetchViaCep(digits);
    if (!viaCep) return null;
    street = viaCep.street;
    neighborhood = viaCep.neighborhood;
    city = viaCep.city;
    state = viaCep.state;
  }

  const served = SERVED_STATES.includes(state);

  // Skip the geocode + distance work entirely for out-of-area CEPs — there's
  // no shipping fee to compute for a delivery we don't make, and it saves a
  // Nominatim call against its 1 req/s budget.
  if (served) {
    if (lat == null || lng == null) {
      const query = `${street}, ${neighborhood}, ${city}, ${state}, Brasil`;
      const point = await geocodeAddress(query);
      if (point) {
        lat = point.lat;
        lng = point.lng;
      }
    }

    if (distanceKm == null && lat != null && lng != null) {
      const atelier = await getAtelierCoords();
      if (atelier) {
        distanceKm = Math.round(haversineKm(atelier, { lat, lng }) * 100) / 100;
      }
    }
  }

  await admin.from('cep_cache').upsert({
    cep: digits,
    street,
    neighborhood,
    city,
    state,
    lat,
    lng,
    distance_km: distanceKm,
    updated_at: new Date().toISOString(),
  });

  const { data: formulaSetting } = await admin.from('settings').select('value').eq('key', 'shipping_formula').maybeSingle();
  const formula = (formulaSetting?.value as ShippingFormula) ?? { base: 30, free_km: 3, per_km: 4 };
  const shippingFee = served && distanceKm != null ? computeShippingFee(distanceKm, formula) : null;

  return { cep: digits, street, neighborhood, city, state, distanceKm, shippingFee, served };
}
