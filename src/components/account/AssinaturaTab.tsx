import Link from 'next/link';
import SubscriptionManageCard from '@/components/subscription/SubscriptionManageCard';
import type { Database } from '@/lib/supabase/types';

type Subscription = Database['public']['Tables']['subscriptions']['Row'];
type Delivery = Database['public']['Tables']['subscription_deliveries']['Row'];
type Address = Database['public']['Tables']['addresses']['Row'];

function fmtDate(d?: string | null) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export default function AssinaturaTab({
  subscription,
  deliveries,
  plans,
  paymentFailed,
  addresses,
}: {
  subscription: Subscription | null;
  deliveries: Delivery[];
  plans: Record<string, number>;
  paymentFailed: boolean;
  addresses: Address[];
}) {
  if (!subscription) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <p style={{ fontSize: 14, color: '#7C7F6D' }}>Você ainda não tem uma assinatura ativa.</p>
        <Link href="/assinatura" style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '13px 24px', borderRadius: 2, fontSize: 13 }}>
          Assinar agora
        </Link>
      </div>
    );
  }

  const pendingDeliveries = deliveries.filter((d) => d.payment_status === 'pending');
  const nextDelivery = pendingDeliveries[0] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SubscriptionManageCard subscription={subscription} nextDeliveryDate={nextDelivery?.delivery_date ?? null} plans={plans} addresses={addresses} />

      {subscription.pending_action && (
        <div style={{ background: '#F6E9D3', border: '1px solid #D9A441', padding: '14px 18px', borderRadius: 2, fontSize: 12.5, color: '#5C4326' }}>
          {subscription.pending_action.type === 'pause'
            ? `Sua pausa entra em vigor a partir de ${fmtDate(subscription.pending_action.effective_date)}.`
            : `Seu cancelamento entra em vigor a partir de ${fmtDate(subscription.pending_action.effective_date)}.`}
        </div>
      )}

      {paymentFailed && nextDelivery && (
        <div style={{ background: '#FBE3E0', border: '1px solid #C4836A', padding: '16px 18px', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <strong style={{ fontSize: 13, color: '#8C3B2C' }}>Não conseguimos cobrar seu cartão para o próximo ciclo.</strong>
          <p style={{ fontSize: 12.5, color: '#5C5F51', margin: 0 }}>
            Atualize os dados do cartão antes de {fmtDate(nextDelivery.delivery_date)} — se não houver atualização
            até a entrega, esse ciclo será pulado automaticamente, sem custo.
          </p>
        </div>
      )}

      {nextDelivery && (
        <div style={{ marginTop: 14, padding: '18px 20px', background: '#FFFFFF', borderRadius: 2, boxShadow: '0 1px 3px rgba(75,87,64,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: '#8A8D7C' }}>Próxima entrega</div>
            <div style={{ fontSize: 14, color: '#4B5740' }}>{fmtDate(nextDelivery.delivery_date)}</div>
            <div style={{ fontSize: 11.5, color: '#8A8D7C', marginTop: 4 }}>
              Prazo p/ cancelar ou pausar sem afetar este ciclo: {fmtDate(nextDelivery.cutoff_date)}
            </div>
          </div>
        </div>
      )}

      {pendingDeliveries.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: '#4B5740', margin: '0 0 14px' }}>Entregas e mensagens</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingDeliveries.map((dl) => (
              <div key={dl.id} style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: 2, boxShadow: '0 1px 3px rgba(75,87,64,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: '#4B5740', fontWeight: 500 }}>Entrega de {fmtDate(dl.delivery_date)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#8A8D7C' }}>Prazo p/ cancelar/pausar/editar mensagem: {fmtDate(dl.cutoff_date)}</div>
                {subscription.recipient_name && <div style={{ fontSize: 11.5, color: '#8A8D7C' }}>Presente para: {subscription.recipient_name}</div>}
                <span style={{ fontSize: 12.5, color: '#8A8D7C', fontStyle: 'italic' }}>&quot;{dl.message}&quot;</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: '#A7AB97', marginTop: 10 }}>
            A mesma mensagem vale para todas as entregas. Use &quot;Editar mensagem&quot; acima para trocá-la a qualquer momento.
          </p>
        </div>
      )}
    </div>
  );
}
