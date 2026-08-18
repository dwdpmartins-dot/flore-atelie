import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureMpCustomer, attachCardToCustomer, detachCardFromCustomer, logMpError } from '@/lib/mercadopago/server';

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
    logMpError('add card failed', err);
    return NextResponse.json({ error: 'Não foi possível salvar o cartão.' }, { status: 502 });
  }
}

// DELETE /api/cards?id=<saved_cards.id> — removes a saved card from both
// Mercado Pago and saved_cards. The select/delete below run through the
// signed-in customer's own session (not the service role), so RLS's "cards
// owner all" policy already scopes this to the caller's own rows — no
// separate ownership check needed.
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Cartão não informado.' }, { status: 400 });

  const { data: card } = await supabase.from('saved_cards').select('id, mp_customer_id, mp_card_id').eq('id', id).maybeSingle();
  if (!card) return NextResponse.json({ error: 'Cartão não encontrado.' }, { status: 404 });

  try {
    await detachCardFromCustomer(card.mp_customer_id, card.mp_card_id);
  } catch (err) {
    // Not fatal: we still remove our own record even if the Mercado Pago
    // side failed (e.g. already detached there some other way). Our
    // saved_cards table is the source of truth for what shows up in "Minha
    // Conta" — nothing in this app can charge a card once it's gone from
    // this table, regardless of what Mercado Pago still has on file.
    logMpError('detachCardFromCustomer failed (removing local record anyway)', err);
  }

  const { error } = await supabase.from('saved_cards').delete().eq('id', card.id);
  if (error) {
    // Postgres foreign-key violation: subscriptions.card_id still points at
    // this card (an active subscription is billing it) — surfaced as a
    // clear message instead of a raw database error.
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Este cartão está vinculado a uma assinatura ativa. Troque o cartão da assinatura antes de removê-lo.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Não foi possível remover o cartão.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
