import { Suspense } from 'react';
import { getCurrentCustomer } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import AuthGate from '@/components/auth/AuthGate';
import AccountDashboard from '@/components/account/AccountDashboard';

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
  const [{ data: orders }, { data: subscriptions }, { data: addresses }, { data: cards }] = await Promise.all([
    supabase.from('orders').select('*').order('created_at', { ascending: false }),
    supabase.from('subscriptions').select('*').in('status', ['ativa', 'pausada']).order('created_at', { ascending: false }).limit(1),
    supabase.from('addresses').select('*').order('preferred', { ascending: false }),
    supabase.from('saved_cards').select('*'),
  ]);

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 28px 110px' }}>
      <Suspense>
        <AccountDashboard
          customer={session.customer}
          email={session.email}
          orders={orders ?? []}
          activeSubscription={subscriptions?.[0] ?? null}
          addresses={addresses ?? []}
          cards={cards ?? []}
        />
      </Suspense>
    </section>
  );
}
