import { NextResponse } from 'next/server';
import { resolveAddress } from '@/lib/geocoding/resolveAddress';

export const runtime = 'nodejs';

// GET /api/cep?cep=01310-100 — resolves street/neighborhood/city/state via
// ViaCEP plus the shipping distance/fee via Nominatim geocoding, backed by
// cep_cache. Used by every address form (Minha Conta, Checkout).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cep = searchParams.get('cep') || '';

  const resolved = await resolveAddress(cep);
  if (!resolved) {
    return NextResponse.json({ error: 'CEP não encontrado.' }, { status: 404 });
  }
  if (!resolved.served) {
    return NextResponse.json({ error: 'Por enquanto entregamos apenas no estado de São Paulo (SP).' }, { status: 422 });
  }

  return NextResponse.json(resolved);
}
