import Link from 'next/link';
import type { Database } from '@/lib/supabase/types';

type Subscription = Database['public']['Tables']['subscriptions']['Row'];

export default function AssinaturaTab({ subscription }: { subscription: Subscription | null }) {
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

  return (
    <div style={{ background: '#F3EDE3', padding: 28, borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#4B5740' }}>
        <span>Plano</span>
        <strong>
          {subscription.freq} · {subscription.size}
        </strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#4B5740' }}>
        <span>Status</span>
        <strong>{subscription.status === 'pausada' ? `Pausada desde ${subscription.paused_since}` : subscription.status}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#4B5740' }}>
        <span>Valor por ciclo</span>
        <strong>R$ {subscription.price}</strong>
      </div>
      <p style={{ fontSize: 12, color: '#8A8D7C', margin: '8px 0 0' }}>
        Gerenciamento completo (pausar, cancelar, trocar plano, editar mensagem) chega na próxima etapa.
      </p>
    </div>
  );
}
