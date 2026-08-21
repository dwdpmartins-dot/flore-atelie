'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SignOutButton from '@/components/auth/SignOutButton';
import DadosTab from './DadosTab';
import PedidosTab from './PedidosTab';
import AssinaturaTab from './AssinaturaTab';
import EnderecosTab from './EnderecosTab';
import CartoesTab from './CartoesTab';
import type { Database } from '@/lib/supabase/types';

type Customer = Database['public']['Tables']['customers']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];
type Subscription = Database['public']['Tables']['subscriptions']['Row'];
type Delivery = Database['public']['Tables']['subscription_deliveries']['Row'];
type Address = Database['public']['Tables']['addresses']['Row'];
type SavedCard = Database['public']['Tables']['saved_cards']['Row'];

const TABS = [
  { key: 'dados', label: 'Dados' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'assinatura', label: 'Assinatura' },
  { key: 'enderecos', label: 'Endereços' },
  { key: 'cartoes', label: 'Cartões' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AccountDashboard({
  customer,
  email,
  orders,
  activeSubscription,
  deliveries,
  plans,
  paymentFailed,
  addresses,
  cards,
}: {
  customer: Customer | null;
  email: string | null;
  orders: Order[];
  activeSubscription: Subscription | null;
  deliveries: Delivery[];
  plans: Record<string, number>;
  paymentFailed: boolean;
  addresses: Address[];
  cards: SavedCard[];
}) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('aba') as TabKey) || 'dados';
  const [tab, setTab] = useState<TabKey>(initialTab);

  // A link like PedidosTab's "Gerenciar →" only changes the ?aba= query
  // param on the same route -- Next.js does a client-side navigation
  // without remounting this component, so the useState above (only ever
  // read once, at mount) never picked up the new value on its own. That's
  // why the target tab wouldn't open until something else happened to
  // force a fresh mount.
  useEffect(() => {
    const aba = searchParams.get('aba');
    if (aba && TABS.some((t) => t.key === aba)) setTab(aba as TabKey);
  }, [searchParams]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontStyle: 'italic', color: '#4B5740', margin: 0 }}>
          Minha Conta
        </h1>
        <SignOutButton />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 34, borderBottom: '1px solid rgba(75,87,64,0.15)', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: tab === t.key ? '#4B5740' : 'transparent',
              color: tab === t.key ? '#FAF7F2' : '#7C7F6D',
              borderRadius: '2px 2px 0 0',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dados' && <DadosTab customer={customer} email={email} />}
      {tab === 'pedidos' && <PedidosTab orders={orders} activeSubscription={activeSubscription} />}
      {tab === 'assinatura' && <AssinaturaTab subscription={activeSubscription} deliveries={deliveries} plans={plans} paymentFailed={paymentFailed} />}
      {tab === 'enderecos' && <EnderecosTab addresses={addresses} />}
      {tab === 'cartoes' && <CartoesTab cards={cards} email={email} />}
    </>
  );
}
