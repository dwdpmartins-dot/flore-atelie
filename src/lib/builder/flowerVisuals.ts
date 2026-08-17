/**
 * Layered-SVG "petal" geometry for each flower, ported 1:1 from the
 * prototype's flowerTypes/buildPetals logic. This is presentation-only
 * (how a flower is drawn), so it lives in code — price/name/availability
 * are the actual business data and come from the `flowers` table instead.
 *
 * Rendering this canvas preview is free (pure SVG, no API calls). The paid
 * OpenAI illustration is a separate, explicit step (see /api/builder/generate-illustration).
 */

export interface FlowerVisual {
  petals: number;
  petalColor: string;
  centerColor: string;
  petalW: number;
  petalH: number;
}

export interface Petal {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  transform: string;
}

const RAW_VISUALS: Record<string, FlowerVisual> = {
  rusgos: { petals: 9, petalColor: '#D98E6B', centerColor: '#8C5B45', petalW: 11, petalH: 22 },
  eucalipto: { petals: 7, petalColor: '#8A9A72', centerColor: '#6B7C5C', petalW: 10, petalH: 30 },
  alstromelia: { petals: 6, petalColor: '#E8965B', centerColor: '#8C5B45', petalW: 8, petalH: 24 },
  gerbera: { petals: 14, petalColor: '#E86B5C', centerColor: '#3A2E1E', petalW: 8, petalH: 24 },
  rosa: { petals: 8, petalColor: '#C4836A', centerColor: '#8C5B45', petalW: 16, petalH: 20 },
  lirio: { petals: 6, petalColor: '#FAF3E6', centerColor: '#D9A441', petalW: 15, petalH: 28 },
  antulio: { petals: 1, petalColor: '#B5453D', centerColor: '#D9A441', petalW: 30, petalH: 34 },
  flordocampo: { petals: 10, petalColor: '#E8C4B8', centerColor: '#D9A441', petalW: 8, petalH: 18 },
  celosia: { petals: 12, petalColor: '#A93F5C', centerColor: '#6B2C3E', petalW: 9, petalH: 16 },
  girasol: { petals: 14, petalColor: '#E8B23D', centerColor: '#5C4326', petalW: 9, petalH: 26 },
  estaticia: { petals: 16, petalColor: '#B7A9D9', centerColor: '#7C6C9E', petalW: 6, petalH: 14 },
  rabodegato: { petals: 1, petalColor: '#8C5B45', centerColor: '#8C5B45', petalW: 8, petalH: 34 },
  rosaspray: { petals: 9, petalColor: '#E8C4B8', centerColor: '#C4836A', petalW: 10, petalH: 16 },
  tulipa: { petals: 6, petalColor: '#D96B7A', centerColor: '#8C5B45', petalW: 14, petalH: 26 },
  folhagens: { petals: 7, petalColor: '#6B7C5C', centerColor: '#4B5740', petalW: 10, petalH: 30 },
  orquidea: { petals: 5, petalColor: '#E8C4B8', centerColor: '#A93F5C', petalW: 14, petalH: 22 },
  // The curated 9-flower list (see supabase/migrations/0008_curated_flowers.sql)
  // replaced the single "rosa" with 3 color variants — each needs its own
  // visual, otherwise they'd all fall back to the same generic rose shape
  // below and look identical in the vase preview despite being different
  // colors.
  rosa_vermelha: { petals: 8, petalColor: '#A93F35', centerColor: '#5C2A1E', petalW: 16, petalH: 20 },
  rosa_branca: { petals: 8, petalColor: '#FAF3E6', centerColor: '#D9A441', petalW: 16, petalH: 20 },
  rosa_cor_rosa: { petals: 8, petalColor: '#E8A5B8', centerColor: '#8C5B45', petalW: 16, petalH: 20 },
  boca_de_leao: { petals: 6, petalColor: '#D9667A', centerColor: '#6B2C3E', petalW: 12, petalH: 28 },
};

function buildPetals(count: number, pw: number, ph: number): Petal[] {
  const cx = 32;
  const cy = 32;
  const orbit = 32 - ph / 2 - 1;
  const petals: Petal[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (360 / count) * i;
    const rad = (angle * Math.PI) / 180;
    const px = cx + Math.sin(rad) * orbit * 0.55;
    const py = cy - Math.cos(rad) * orbit * 0.55;
    petals.push({ cx: px, cy: py, rx: pw / 2, ry: ph / 2, transform: `rotate(${angle} ${px} ${py})` });
  }
  return petals;
}

export interface FlowerVisualResolved extends FlowerVisual {
  petalsSvg: Petal[];
  centerR: number;
}

const RESOLVED: Record<string, FlowerVisualResolved> = Object.fromEntries(
  Object.entries(RAW_VISUALS).map(([id, v]) => [
    id,
    { ...v, petalsSvg: buildPetals(v.petals, v.petalW, v.petalH), centerR: Math.max(6, v.petalH * 0.22) },
  ])
);

export function getFlowerVisual(id: string): FlowerVisualResolved {
  return RESOLVED[id] ?? RESOLVED.rosa;
}
