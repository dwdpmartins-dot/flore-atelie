import Link from 'next/link';
import { getCurrentCustomer, hasCompleteProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import SubscriptionManageCard from '@/components/subscription/SubscriptionManageCard';
import SubscriptionWizard from '@/components/subscription/SubscriptionWizard';

export const metadata = { title: 'Assinatura — Florê Ateliê' };

export default async function AssinaturaPage() {
  const session = await getCurrentCustomer();

  const header = (
    <div style={{ textAlign: 'center', marginBottom: 44 }}>
      <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#C4836A' }}>Assinatura</span>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,42px)', fontStyle: 'italic', color: '#4B5740', margin: '10px 0 12px' }}>
        Assine e encante, sempre
      </h1>
      <p style={{ fontSize: 15, color: '#7C7F6D', maxWidth: 520, margin: '0 auto' }}>
        Flores novas chegando no ritmo que você escolher — com uma mensagem sua em cada entrega.
      </p>
    </div>
  );

  if (!session || !hasCompleteProfile(session.customer)) {
    return (
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 28px 110px' }}>
        {header}
        <div style={{ textAlign: 'center', padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <p style={{ fontSize: 14, color: '#7C7F6D', maxWidth: 400 }}>
            Para assinar, entre na sua conta e confirme nome e WhatsApp — assim conseguimos avisar sobre cada
            entrega.
          </p>
          <Link href={`/minha-conta?redirect=${encodeURIComponent('/assinatura')}`} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '14px 28px', borderRadius: 2, fontSize: 14 }}>
            Ir para Minha Conta
          </Link>
        </div>
      </section>
    );
  }

  const supabase = await createClient();
  const [{ data: plans }, { data: addresses }, { data: subs }] = await Promise.all([
    supabase.from('subscription_plans').select('*'),
    supabase.from('addresses').select('*').order('preferred', { ascending: false }),
    supabase.from('subscriptions').select('*').in('status', ['ativa', 'pausada']).order('created_at', { ascending: false }).limit(1),
  ]);

  const activeSubscription = subs?.[0] ?? null;
  const planMap: Record<string, number> = {};
  (plans ?? []).forEach((p) => {
    planMap[`${p.freq}-${p.size}`] = p.price;
  });

  let nextDeliveryDate: string | null = null;
  if (activeSubscription) {
    const { data: nd } = await supabase
      .from('subscription_deliveries')
      .select('delivery_date')
      .eq('subscription_id', activeSubscription.id)
      .eq('payment_status', 'pending')
      .order('sequence_index', { ascending: true })
      .limit(1)
      .maybeSingle();
    nextDeliveryDate = nd?.delivery_date ?? null;
  }

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 28px 110px' }}>
      {header}
      {activeSubscription ? (
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <p style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#C4836A', textAlign: 'center', marginBottom: 14 }}>
            Você já é assinante
          </p>
          <SubscriptionManageCard subscription={activeSubscription} nextDeliveryDate={nextDeliveryDate} plans={planMap} addresses={addresses ?? []} />
        </div>
      ) : (
        <SubscriptionWizard plans={planMap} addresses={addresses ?? []} email={session.email} />
      )}
    </section>
  );
}
