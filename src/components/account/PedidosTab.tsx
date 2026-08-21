import Link from 'next/link';
import { todayISO } from '@/lib/delivery/holidays';
import type { Database } from '@/lib/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type Subscription = Database['public']['Tables']['subscriptions']['Row'];
type Delivery = Database['public']['Tables']['subscription_deliveries']['Row'];

const STATUS_LABELS: Record<Order['status'], string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  pagamento_recusado: 'Pagamento recusado',
};

const STATUS_STYLES: Record<Order['status'], { color: string; bg: string }> = {
  pendente: { color: '#8C6D2F', bg: '#F6E9D3' },
  em_andamento: { color: '#4B5740', bg: '#EDF0E4' },
  entregue: { color: '#3E5C43', bg: '#E1EBDD' },
  cancelado: { color: '#8A8D7C', bg: '#EFEAE0' },
  pagamento_recusado: { color: '#8C3B2C', bg: '#FBE3E0' },
};

const UPCOMING_WINDOW_DAYS = 7;

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export default function PedidosTab({
  orders,
  activeSubscription,
  deliveries,
}: {
  orders: Order[];
  activeSubscription: Subscription | null;
  deliveries: Delivery[];
}) {
  const pendingDeliveries = deliveries.filter((d) => d.payment_status === 'pending').sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
  const nextDelivery = pendingDeliveries[0] ?? null;

  // Only the ones landing soon show up here as their own cards — this is
  // meant to answer "when's my next flower coming", not duplicate the full
  // schedule already in the Assinatura tab.
  const upcomingCutoff = (() => {
    const d = new Date(`${todayISO()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + UPCOMING_WINDOW_DAYS);
    return d.toISOString().slice(0, 10);
  })();
  const upcomingDeliveries = pendingDeliveries.filter((d) => d.delivery_date <= upcomingCutoff);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {activeSubscription && (
        <div
          style={{
            padding: '18px 20px',
            background: '#EFE9DC',
            borderRadius: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            border: '1px solid #D8CFC0',
          }}
        >
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#C4836A', marginBottom: 4 }}>
              Assinatura · {activeSubscription.freq} · {activeSubscription.size}
            </div>
            {nextDelivery ? (
              <div style={{ fontSize: 13, color: '#4B5740' }}>Próxima entrega: {fmtDate(nextDelivery.delivery_date)}</div>
            ) : (
              <div style={{ fontSize: 13, color: '#4B5740' }}>Mensagem: &quot;{activeSubscription.message.slice(0, 60)}&quot;</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12, color: '#6B7C5C', background: '#EDF0E4', padding: '5px 10px', borderRadius: 20 }}>
              {activeSubscription.status}
            </span>
            <Link href="/minha-conta?aba=assinatura" style={{ background: 'none', border: 'none', color: '#C4836A', fontSize: 12.5 }}>
              Gerenciar →
            </Link>
          </div>
        </div>
      )}

      {upcomingDeliveries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontStyle: 'italic', color: '#4B5740', margin: '4px 0 0' }}>
            Nos próximos {UPCOMING_WINDOW_DAYS} dias
          </h3>
          {upcomingDeliveries.map((dl) => (
            <div
              key={dl.id}
              style={{
                padding: '16px 18px',
                background: '#FFFFFF',
                borderRadius: 2,
                boxShadow: '0 1px 3px rgba(75,87,64,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: '#4B5740', fontWeight: 500 }}>Entrega de {fmtDate(dl.delivery_date)}</div>
                <div style={{ fontSize: 12, color: '#8A8D7C', fontStyle: 'italic', marginTop: 3 }}>&quot;{dl.message}&quot;</div>
              </div>
              <Link href="/minha-conta?aba=assinatura" style={{ background: 'none', border: 'none', color: '#C4836A', fontSize: 12.5, flexShrink: 0 }}>
                Editar mensagem →
              </Link>
            </div>
          ))}
        </div>
      )}

      {orders.length === 0 && !activeSubscription && (
        <p style={{ fontSize: 14, color: '#7C7F6D', textAlign: 'center', padding: '40px 0' }}>Você ainda não fez nenhum pedido.</p>
      )}

      {orders.map((o) => (
        <div
          key={o.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 18px',
            background: '#FFFFFF',
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(75,87,64,0.06)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: '#4B5740' }}>{o.kind === 'assinatura' ? 'Entrega de assinatura' : 'Buquê avulso'}</div>
            <div style={{ fontSize: 11, color: '#8A8D7C' }}>
              {o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <span style={{ fontSize: 12, color: STATUS_STYLES[o.status].color, background: STATUS_STYLES[o.status].bg, padding: '5px 10px', borderRadius: 20 }}>
            {STATUS_LABELS[o.status]}
          </span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, color: '#4B5740' }}>R$ {o.total}</span>
        </div>
      ))}
    </div>
  );
}
