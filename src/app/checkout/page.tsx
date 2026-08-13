import { requireCustomer } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import CheckoutFlow from '@/components/checkout/CheckoutFlow';

export const metadata = { title: 'Finalizar pedido — Florê Ateliê' };

export default async function CheckoutPage() {
  const session = await requireCustomer('/checkout');

  const supabase = await createClient();
  const [{ data: addresses }, { data: cards }] = await Promise.all([
    supabase.from('addresses').select('*').order('preferred', { ascending: false }),
    supabase.from('saved_cards').select('*'),
  ]);

  return (
    <section style={{ maxWidth: 720, margin: '0 auto', padding: '60px 28px 110px' }}>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,4vw,36px)', fontStyle: 'italic', color: '#4B5740', margin: '0 0 30px', textAlign: 'center' }}>
        Finalizar pedido
      </h1>
      <CheckoutFlow customer={session.customer} email={session.email} addresses={addresses ?? []} cards={cards ?? []} />
    </section>
  );
}
