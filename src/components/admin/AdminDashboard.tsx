'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  toggleAi,
  toggleSimulateDecline,
  updateShippingFormula,
  updateInspiradoPrice,
  updatePlanPrice,
  updateFlowerPrice,
  toggleFlowerActive,
  toggleBouquetActive,
  simulatePaymentFailure,
  clearPaymentFailure,
  markOrderDelivered,
  markOrderCancelled,
} from '@/app/admin/(protected)/actions';
import type { Database, Freq, Size } from '@/lib/supabase/types';
import type { UpcomingCharge, AdminOrder } from '@/app/admin/(protected)/page';

type Plan = Database['public']['Tables']['subscription_plans']['Row'];
type Flower = Database['public']['Tables']['flowers']['Row'];
type Bouquet = Database['public']['Tables']['bouquets']['Row'];

const card: React.CSSProperties = { background: '#FFFFFF', borderRadius: 2, padding: 24, marginBottom: 24, boxShadow: '0 1px 4px rgba(75,87,64,0.08)' };
const h3: React.CSSProperties = { fontFamily: "'Playfair Display',serif", fontSize: 16, color: '#4B5740', margin: '0 0 16px' };
const numInput: React.CSSProperties = { width: 70, padding: 8, border: '1px solid #D8CFC0', borderRadius: 2 };

const STATUS_LABEL: Record<UpcomingCharge['payment_status'], string> = { pending: 'aguardando corte', paid: 'cobrado', failed: 'falhou', skipped: 'pulado' };
const STATUS_COLOR: Record<UpcomingCharge['payment_status'], string> = { pending: '#8A8D7C', paid: '#3E5C43', failed: '#8C3B2C', skipped: '#8A8D7C' };

const ORDER_STATUS_LABEL: Record<AdminOrder['status'], string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  pagamento_recusado: 'Pagamento recusado',
};
const ORDER_STATUS_STYLE: Record<AdminOrder['status'], { color: string; bg: string }> = {
  pendente: { color: '#8C6D2F', bg: '#F6E9D3' },
  em_andamento: { color: '#4B5740', bg: '#EDF0E4' },
  entregue: { color: '#3E5C43', bg: '#E1EBDD' },
  cancelado: { color: '#8A8D7C', bg: '#EFEAE0' },
  pagamento_recusado: { color: '#8C3B2C', bg: '#FBE3E0' },
};

function money(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminDashboard({
  aiEnabled,
  simulateDecline,
  shipping,
  inspiradoPrices,
  plans,
  flowers,
  bouquets,
  upcomingCharges,
  kpis,
  recentOrders,
}: {
  aiEnabled: boolean;
  simulateDecline: boolean;
  shipping: { base: number; free_km: number; per_km: number };
  inspiradoPrices: { P: number; M: number; G: number };
  plans: Plan[];
  flowers: Flower[];
  bouquets: Bouquet[];
  upcomingCharges: UpcomingCharge[];
  kpis: { totalRevenue: number; monthRevenue: number; orderCount: number; avgTicket: number; activeSubscriptions: number };
  recentOrders: AdminOrder[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [shippingBase, setShippingBase] = useState(shipping.base);
  const [shippingFreeKm, setShippingFreeKm] = useState(shipping.free_km);
  const [shippingPerKm, setShippingPerKm] = useState(shipping.per_km);

  function refresh() {
    startTransition(() => router.refresh());
  }

  const planByFreqSize = (freq: Freq, size: Size) => plans.find((p) => p.freq === freq && p.size === size)?.price ?? 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Faturamento total" value={money(kpis.totalRevenue)} />
        <KpiCard label="Faturamento no mês" value={money(kpis.monthRevenue)} />
        <KpiCard label="Pedidos pagos" value={String(kpis.orderCount)} />
        <KpiCard label="Ticket médio" value={money(kpis.avgTicket)} />
        <KpiCard label="Assinaturas ativas" value={String(kpis.activeSubscriptions)} />
      </div>

      <div style={card}>
        <h3 style={h3}>Pedidos recentes</h3>
        <p style={{ fontSize: 12, color: '#8A8D7C', margin: '0 0 16px' }}>
          Assim que um pedido é pago, ele aparece aqui como <em>Em andamento</em> — prepare e entregue, depois marque
          como entregue.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recentOrders.length === 0 && <p style={{ fontSize: 12.5, color: '#A7AB97', margin: 0 }}>Nenhum pedido ainda.</p>}
          {recentOrders.map((o) => (
            <div key={o.id} style={{ padding: '14px 16px', background: '#F3EDE3', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 13, color: '#4B5740', fontWeight: 500 }}>{o.customers?.name || 'Cliente'}</span>
                  <span style={{ fontSize: 11.5, color: '#8A8D7C', marginLeft: 8 }}>
                    {o.kind === 'assinatura' ? 'assinatura' : 'avulso'} · {new Date(o.created_at).toLocaleDateString('pt-BR')}
                    {o.delivery_date ? ` · entrega ${new Date(o.delivery_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, color: '#4B5740' }}>{money(Number(o.total))}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: ORDER_STATUS_STYLE[o.status].color,
                      background: ORDER_STATUS_STYLE[o.status].bg,
                      padding: '4px 10px',
                      borderRadius: 20,
                    }}
                  >
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                </div>
              </div>
              {o.order_items.length > 0 && (
                <div style={{ fontSize: 12, color: '#5C5F51' }}>{o.order_items.map((i) => `${i.qty}× ${i.name_snapshot}`).join(', ')}</div>
              )}
              {o.addresses && (
                <div style={{ fontSize: 11.5, color: '#8A8D7C' }}>
                  {o.addresses.street}, {o.addresses.number} · {o.addresses.neighborhood} · {o.addresses.city}
                  {o.customers?.phone ? ` · ${o.customers.phone}` : ''}
                </div>
              )}
              {o.status === 'em_andamento' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => markOrderDelivered(o.id).then(refresh)}
                    style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid #4B5740', color: '#4B5740', padding: '7px 14px', borderRadius: 2, fontSize: 12, cursor: 'pointer' }}
                  >
                    Marcar como entregue
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Marcar este pedido como cancelado? Use isso para refletir um estorno feito no Mercado Pago, por exemplo.')) {
                        markOrderCancelled(o.id).then(refresh);
                      }
                    }}
                    style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid #C4836A', color: '#C4836A', padding: '7px 14px', borderRadius: 2, fontSize: 12, cursor: 'pointer' }}
                  >
                    Marcar como cancelado
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={h3}>Geração de ilustração por IA</h3>
          <p style={{ fontSize: 12.5, color: '#8A8D7C', margin: 0 }}>Preview por camadas permanece sempre ativo, sem custo. Isso controla apenas a ilustração final.</p>
        </div>
        <button
          onClick={() => {
            toggleAi().then(refresh);
          }}
          style={{ padding: '10px 18px', border: 'none', borderRadius: 20, background: aiEnabled ? '#4B5740' : '#A7AB97', color: '#FAF7F2', fontSize: 12, cursor: 'pointer' }}
        >
          {aiEnabled ? 'Ativado' : 'Desativado'}
        </button>
      </div>

      <div style={card}>
        <h3 style={h3}>Próximas cobranças confirmadas</h3>
        <p style={{ fontSize: 12, color: '#8A8D7C', margin: '0 0 16px' }}>
          Ciclos que já passaram do prazo de corte (3 dias úteis antes da entrega) — compre as flores com base nessa lista.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upcomingCharges.length === 0 && <p style={{ fontSize: 12.5, color: '#A7AB97', margin: 0 }}>Nenhum ciclo confirmado no momento.</p>}
          {upcomingCharges.map((u) => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F3EDE3', borderRadius: 2, gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: '#4B5740' }}>
                {u.subscriptions?.customers?.name || 'Cliente'} — {u.subscriptions?.freq} · {u.subscriptions?.size}
              </span>
              <span style={{ fontSize: 12, color: '#8A8D7C' }}>
                entrega {u.delivery_date} · corte {u.cutoff_date}
              </span>
              <span style={{ fontSize: 11, color: STATUS_COLOR[u.payment_status] }}>{STATUS_LABEL[u.payment_status]}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(75,87,64,0.1)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => simulatePaymentFailure().then(refresh)}
            style={{ background: 'none', border: '1px solid #C4836A', color: '#C4836A', padding: '9px 16px', borderRadius: 2, fontSize: 12, cursor: 'pointer' }}
          >
            Simular falha de cobrança (demo)
          </button>
          <button
            onClick={() => clearPaymentFailure().then(refresh)}
            style={{ background: 'none', border: '1px solid #4B5740', color: '#4B5740', padding: '9px 16px', borderRadius: 2, fontSize: 12, cursor: 'pointer' }}
          >
            Limpar falha (demo)
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => toggleSimulateDecline().then(refresh)}
            style={{ background: 'none', border: '1px solid #C4836A', color: '#C4836A', padding: '9px 16px', borderRadius: 2, fontSize: 12, cursor: 'pointer' }}
          >
            {simulateDecline ? 'Desativar simulação de recusa' : 'Simular pagamento recusado'}
          </button>
          <span style={{ fontSize: 11, color: '#8A8D7C', marginLeft: 10 }}>
            Quando ativo, todo checkout/assinatura mostra o pagamento recusado (para testar esse fluxo).
          </span>
        </div>
      </div>

      <div style={card}>
        <h3 style={h3}>Fórmula de frete</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11.5, color: '#8A8D7C' }}>Taxa base (R$)</label>
            <input
              type="number"
              value={shippingBase}
              onChange={(e) => setShippingBase(Number(e.target.value))}
              onBlur={() => updateShippingFormula(shippingBase, shippingFreeKm, shippingPerKm).then(refresh)}
              style={{ ...numInput, width: '100%', marginTop: 4 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: '#8A8D7C' }}>Km incluídos</label>
            <input
              type="number"
              value={shippingFreeKm}
              onChange={(e) => setShippingFreeKm(Number(e.target.value))}
              onBlur={() => updateShippingFormula(shippingBase, shippingFreeKm, shippingPerKm).then(refresh)}
              style={{ ...numInput, width: '100%', marginTop: 4 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: '#8A8D7C' }}>R$/km adicional</label>
            <input
              type="number"
              value={shippingPerKm}
              onChange={(e) => setShippingPerKm(Number(e.target.value))}
              onBlur={() => updateShippingFormula(shippingBase, shippingFreeKm, shippingPerKm).then(refresh)}
              style={{ ...numInput, width: '100%', marginTop: 4 }}
            />
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={h3}>Assinatura — preços por frequência × tamanho</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(['Semanal', 'Quinzenal', 'Mensal'] as Freq[]).map((freq) => (
            <div key={freq} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ width: 90, fontSize: 13, color: '#4B5740' }}>{freq}</span>
              {(['P', 'M', 'G'] as Size[]).map((size) => (
                <PriceField key={size} label={size} value={planByFreqSize(freq, size)} onCommit={(v) => updatePlanPrice(freq, size, v).then(refresh)} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={h3}>Buquê Inspirado da Florê — preço padrão</h3>
        <p style={{ fontSize: 12, color: '#8A8D7C', margin: '0 0 14px' }}>Usado quando o cliente não escolhe uma referência específica da galeria.</p>
        <div style={{ display: 'flex', gap: 16 }}>
          {(['P', 'M', 'G'] as Size[]).map((size) => (
            <PriceField key={size} label={size} value={inspiradoPrices[size]} onCommit={(v) => updateInspiradoPrice(size, v).then(refresh)} />
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={h3}>Flores — preços e disponibilidade</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flowers.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1, fontSize: 13, color: '#4B5740' }}>{f.name}</span>
              <span style={{ fontSize: 12, color: '#8A8D7C' }}>R$</span>
              <PriceField label="" value={f.price} onCommit={(v) => updateFlowerPrice(f.id, v).then(refresh)} />
              <button
                onClick={() => toggleFlowerActive(f.id).then(refresh)}
                style={{ width: 110, padding: 8, border: 'none', borderRadius: 20, background: f.active ? '#4B5740' : '#A7AB97', color: '#FAF7F2', fontSize: 11, cursor: 'pointer' }}
              >
                {f.active ? 'Disponível' : 'Indisponível'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={h3}>Arranjos do catálogo</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bouquets.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1, fontSize: 13, color: '#4B5740' }}>{b.name}</span>
              <button
                onClick={() => toggleBouquetActive(b.id).then(refresh)}
                style={{ width: 130, padding: 8, border: 'none', borderRadius: 20, background: b.active ? '#4B5740' : '#A7AB97', color: '#FAF7F2', fontSize: 11, cursor: 'pointer' }}
              >
                {b.active ? 'No catálogo' : 'Oculto'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 2, padding: '18px 20px', boxShadow: '0 1px 4px rgba(75,87,64,0.08)' }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#8A8D7C', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#4B5740' }}>{value}</div>
    </div>
  );
}

function PriceField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {label && <span style={{ fontSize: 11.5, color: '#8A8D7C' }}>{label}</span>}
      <input type="number" value={v} onChange={(e) => setV(Number(e.target.value))} onBlur={() => onCommit(v)} style={numInput} />
    </div>
  );
}
