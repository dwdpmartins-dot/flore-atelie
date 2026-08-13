import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureMpCustomer, attachCardToCustomer } from '@/lib/mercadopago/server';

export const runtime = 'nodejs';

// POST /api/cards — attaches a Mercado Pago card token (minted client-side
// by the Card Payment Brick) to the signed-in customer's MP Customer, and
// stores the resulting card reference (never the PAN) in saved_cards.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const token = body?.token as string | undefined;
  if (!token) return NextResponse.json({ error: 'Token do cartão ausente.' }, { status: 400 });

  const { data: customer } = await supabase.from('customers').select('mp_customer_id, name, email').eq('id', user.id).maybeSingle();

  try {
    const mpCustomerId = await ensureMpCustomer({
      existingMpCustomerId: customer?.mp_customer_id ?? null,
      email: customer?.email || user.email || '',
      name: customer?.name,
    });

    if (!customer?.mp_customer_id) {
      await supabase.from('customers').update({ mp_customer_id: mpCustomerId }).eq('id', user.id);
    }

    const card = await attachCardToCustomer(mpCustomerId, token);

    const { data: saved, error } = await supabase
      .from('saved_cards')
      .insert({
        customer_id: user.id,
        mp_customer_id: mpCustomerId,
        mp_card_id: card.mpCardId,
        brand: card.brand ?? null,
        last4: card.last4 ?? null,
        cardholder_name: card.cardholderName ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ card: saved });
  } catch (err) {
    console.error('add card failed', err);
    return NextResponse.json({ error: 'Não foi possível salvar o cartão.' }, { status: 502 });
  }
}
