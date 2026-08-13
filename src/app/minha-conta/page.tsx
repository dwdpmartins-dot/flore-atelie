import { Suspense } from 'react';
import { getCurrentCustomer } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import AuthGate from '@/components/auth/AuthGate';
import AccountDashboard from '@/components/account/AccountDashboard';
import type { Database } from '@/lib/supabase/types';

type Delivery = Database['public']['Tables']['subscription_deliveries']['Row'];

export default async function MinhaContaPage() {
  const session = await getCurrentCustomer();

  if (!session) {
    return (
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 28px 110px' }}>
        <Suspense>
          <AuthGate />
        </Suspense>
      </section>
    );
  }

  const supabase = await createClient();
  const [{ data: orders }, { data: subscriptions }, { data: addresses }, { data: cards }, { data: plans }] = await Promise.all([
    supabase.from('orders').select('*').order('created_at', { ascending: false }),
    supabase.from('subscriptions').select('*').in('status', ['ativa', 'pausada']).order('created_at', { ascending: false }).limit(1),
    supabase.from('addresses').select('*').order('preferred', { ascending: false }),
    supabase.from('saved_cards').select('*'),
    supabase.from('subscription_plans').select('*'),
  ]);

  const activeSubscription = subscriptions?.[0] ?? null;

  let deliveries: Delivery[] = [];
  let paymentFailed = false;
  if (activeSubscription) {
    const { data } = await supabase
      .from('subscription_deliveries')
      .select('*')
      .eq('subscription_id', activeSubscription.id)
      .order('sequence_index', { ascending: true });
    deliveries = data ?? [];
    paymentFailed = deliveries.some((d) => d.payment_status === 'failed');
  }

  const planMap: Record<string, number> = {};
  (plans ?? []).forEach((p) => {
    planMap[`${p.freq}-${p.size}`] = p.price;
  });

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 28px 110px' }}>
      <Suspense>
        <AccountDashboard
          customer={session.customer}
          email={session.email}
          orders={orders ?? []}
          activeSubscription={activeSubscription}
          deliveries={deliveries ?? []}
          plans={planMap}
          paymentFailed={paymentFailed}
          addresses={addresses ?? []}
          cards={cards ?? []}
        />
      </Suspense>
    </section>
  );
}
