export interface ShippingFormula {
  base: number;
  free_km: number;
  per_km: number;
}

/** fee = base + max(0, distanceKm - free_km) * per_km — admin-configurable via settings.shipping_formula. */
export function computeShippingFee(distanceKm: number, formula: ShippingFormula): number {
  const billableKm = Math.max(0, distanceKm - formula.free_km);
  return Math.round((formula.base + billableKm * formula.per_km) * 100) / 100;
}
