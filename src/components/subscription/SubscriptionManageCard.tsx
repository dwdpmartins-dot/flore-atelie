'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { pauseSubscription, resumeSubscription, cancelSubscription, editSubscriptionMessage, changeSubscriptionPlan, changeSubscriptionAddress } from '@/app/assinatura/actions';
import InlineAddressForm from '@/components/address/InlineAddressForm';
import type { Database, Freq, Size } from '@/lib/supabase/types';

type Subscription = Database['public']['Tables']['subscriptions']['Row'];
type Address = Database['public']['Tables']['addresses']['Row'];

const FREQS: Freq[] = ['Semanal', 'Quinzenal', 'Mensal'];
const SIZES: Size[] = ['P', 'M', 'G'];

function fmtDate(d?: string | null) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export default function SubscriptionManageCard({
  subscription,
  nextDeliveryDate,
  plans,
  addresses: initialAddresses,
}: {
  subscription: Subscription;
  nextDeliveryDate: string | null;
  plans: Record<string, number>;
  addresses: Address[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<'pause' | 'cancel' | null>(null);
  const [editingMessage, setEditingMessage] = useState(false);
  const [message, setMessage] = useState(subscription.message);
  const [changingPlan, setChangingPlan] = useState(false);
  const [freq, setFreq] = useState<Freq>(subscription.freq);
  const [size, setSize] = useState<Size>(subscription.size);
  const [changingAddress, setChangingAddress] = useState(false);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(subscription.address_id ?? '');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const currentAddress = addresses.find((a) => a.id === subscription.address_id);

  const isPaused = subscription.status === 'pausada';

  async function refresh() {
    router.refresh();
  }

  async function handlePauseOrResume() {
    if (isPaused) {
      setBusy(true);
      await resumeSubscription(subscription.id);
      setBusy(false);
      refresh();
    } else {
      setModal('pause');
    }
  }

  async function confirmPause() {
    setBusy(true);
    const result = await pauseSubscription(subscription.id);
    setBusy(false);
    setModal(null);
    if (result && 'effectiveDate' in result && result.effectiveDate) {
      setNotice(`Esse ciclo já está confirmado. Sua pausa será aplicada a partir da próxima entrega, em ${fmtDate(result.effectiveDate)}.`);
    }
    refresh();
  }

  async function confirmCancel() {
    setBusy(true);
    const result = await cancelSubscription(subscription.id);
    setBusy(false);
    setModal(null);
    if (result && 'effectiveDate' in result && result.effectiveDate) {
      setNotice(`Esse ciclo já está confirmado. Seu cancelamento será aplicado a partir da próxima entrega, em ${fmtDate(result.effectiveDate)}.`);
    }
    refresh();
  }

  async function saveMessage() {
    setBusy(true);
    const result = await editSubscriptionMessage(subscription.id, message);
    setBusy(false);
    setEditingMessage(false);
    if (result && 'lockedThisCycle' in result && result.lockedThisCycle && result.effectiveDate) {
      setNotice(`Essa entrega já está confirmada com a mensagem anterior. Sua alteração valerá a partir da próxima entrega, em ${fmtDate(result.effectiveDate)}.`);
    }
    refresh();
  }

  async function savePlan() {
    setBusy(true);
    const result = await changeSubscriptionPlan(subscription.id, freq, size);
    setBusy(false);
    if (result && 'error' in result && result.error) {
      setNotice(result.error);
      return;
    }
    setChangingPlan(false);
    if (result && 'effectiveDate' in result && result.effectiveDate) {
      setNotice(`Sua próxima entrega já está confirmada com o plano anterior. A alteração de plano vale a partir de ${fmtDate(result.effectiveDate)}.`);
    }
    refresh();
  }

  async function saveAddress() {
    if (!addressId) return;
    setBusy(true);
    const result = await changeSubscriptionAddress(subscription.id, addressId);
    setBusy(false);
    setChangingAddress(false);
    if (result && 'error' in result && result.error) {
      setNotice(result.error);
      return;
    }
    // Takes effect from the next charge onward — no "locked this cycle"
    // case here, unlike message/plan (see changeSubscriptionAddress).
    setNotice('Endereço atualizado. Vale a partir da próxima cobrança.');
    refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#F3EDE3', padding: 28, borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#4B5740' }}>
          <span>Plano</span>
          <strong>
            {subscription.freq} · {subscription.size}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#4B5740' }}>
          <span>Status</span>
          <strong>{isPaused ? `Pausada desde ${fmtDate(subscription.paused_since)}` : subscription.status}</strong>
        </div>
        {isPaused && <p style={{ fontSize: 12, color: '#8A8D7C', margin: 0, fontStyle: 'italic' }}>Sem data de término prevista — sua assinatura espera por você.</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#4B5740', gap: 14 }}>
          <span style={{ flexShrink: 0 }}>Endereço</span>
          <strong style={{ textAlign: 'right' }}>{currentAddress ? `${currentAddress.street}, ${currentAddress.number}` : '—'}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#4B5740' }}>
          <span>Valor por ciclo</span>
          <strong>R$ {subscription.price}</strong>
        </div>
        {nextDeliveryDate && !isPaused && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#4B5740' }}>
            <span>Próxima entrega</span>
            <strong>{fmtDate(nextDeliveryDate)}</strong>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <button disabled={busy} onClick={handlePauseOrResume} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #4B5740', color: '#4B5740', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
            {isPaused ? 'Retomar assinatura' : 'Pausar'}
          </button>
          <button disabled={busy} onClick={() => setEditingMessage((v) => !v)} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #4B5740', color: '#4B5740', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
            Editar mensagem
          </button>
          <button disabled={busy} onClick={() => setChangingPlan((v) => !v)} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #4B5740', color: '#4B5740', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
            Alterar plano
          </button>
          <button disabled={busy} onClick={() => setChangingAddress((v) => !v)} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #4B5740', color: '#4B5740', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
            Alterar endereço
          </button>
          <button disabled={busy} onClick={() => setModal('cancel')} style={{ flex: 1, background: 'none', border: '1px solid #C4836A', color: '#C4836A', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>

      {editingMessage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#FFFFFF', padding: 18, borderRadius: 2, boxShadow: '0 1px 3px rgba(75,87,64,0.06)' }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 180))}
            maxLength={180}
            style={{ width: '100%', minHeight: 90, padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontFamily: "'Work Sans'", fontSize: 13.5, resize: 'vertical' }}
          />
          <p style={{ fontSize: 11, color: '#A7AB97', margin: 0, textAlign: 'right' }}>{message.length}/180</p>
          <button onClick={saveMessage} disabled={busy} style={{ alignSelf: 'flex-start', background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '10px 18px', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
            Salvar mensagem
          </button>
        </div>
      )}

      {changingPlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: '#FFFFFF', padding: 18, borderRadius: 2, boxShadow: '0 1px 3px rgba(75,87,64,0.06)' }}>
          {subscription.mp_preapproval_id ? (
            <p style={{ fontSize: 12, color: '#8A8D7C', margin: 0 }}>
              A frequência ({subscription.freq}) não pode ser alterada aqui — para mudar o ritmo das entregas,
              cancele esta assinatura e assine novamente. O tamanho do buquê pode ser trocado livremente.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {FREQS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  style={{ padding: '10px 18px', borderRadius: 2, border: '1px solid #4B5740', background: freq === f ? '#4B5740' : 'transparent', color: freq === f ? '#FAF7F2' : '#4B5740', fontSize: 13, cursor: 'pointer' }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            {SIZES.map((sz) => (
              <button
                key={sz}
                onClick={() => setSize(sz)}
                style={{ padding: '10px 18px', borderRadius: 2, border: '1px solid #4B5740', background: size === sz ? '#4B5740' : 'transparent', color: size === sz ? '#FAF7F2' : '#4B5740', fontSize: 13, cursor: 'pointer' }}
              >
                {sz} · R$ {plans[`${freq}-${sz}`] ?? '—'}
              </button>
            ))}
          </div>
          <button onClick={savePlan} disabled={busy} style={{ alignSelf: 'flex-start', background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '10px 18px', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
            Confirmar novo plano
          </button>
        </div>
      )}

      {changingAddress && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#FFFFFF', padding: 18, borderRadius: 2, boxShadow: '0 1px 3px rgba(75,87,64,0.06)' }}>
          <p style={{ fontSize: 12, color: '#8A8D7C', margin: 0 }}>
            Vale a partir da próxima cobrança — não afeta uma entrega já confirmada para o ciclo atual.
          </p>
          {addresses.map((a) => (
            <button
              key={a.id}
              onClick={() => setAddressId(a.id)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                border: `1.5px solid ${addressId === a.id ? '#4B5740' : '#D8CFC0'}`,
                background: addressId === a.id ? '#F3EDE3' : '#FFFFFF',
                borderRadius: 2,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #4B5740', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {addressId === a.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4B5740' }} />}
              </div>
              <div>
                <div style={{ fontSize: 13.5, color: '#4B5740', fontWeight: 500 }}>{a.label}</div>
                <div style={{ fontSize: 12.5, color: '#7C7F6D', marginTop: 3 }}>
                  {a.street}, {a.number} · {a.neighborhood} · {a.city}/{a.state}
                </div>
              </div>
            </button>
          ))}
          <button onClick={() => setShowNewAddress((v) => !v)} style={{ background: 'none', border: 'none', color: '#C4836A', fontSize: 13, cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            {showNewAddress ? 'Cancelar' : '+ Adicionar endereço'}
          </button>
          {showNewAddress && (
            <InlineAddressForm
              onSaved={(addr) => {
                setAddresses((prev) => [...prev, addr]);
                setAddressId(addr.id);
                setShowNewAddress(false);
              }}
            />
          )}
          <button
            onClick={saveAddress}
            disabled={busy || !addressId}
            style={{ alignSelf: 'flex-start', background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '10px 18px', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}
          >
            Confirmar novo endereço
          </button>
        </div>
      )}

      {notice && <div style={{ background: '#F6E9D3', border: '1px solid #D9A441', padding: '14px 18px', borderRadius: 2, fontSize: 12.5, color: '#5C4326' }}>{notice}</div>}

      {modal === 'pause' && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(43,49,36,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#FAF7F2', maxWidth: 420, width: '100%', borderRadius: 2, padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#C4836A' }}>Pausar assinatura</span>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 20, color: '#4B5740', margin: 0 }}>Um intervalo, não um adeus.</h3>
            <p style={{ fontSize: 13.5, color: '#5C5F51', lineHeight: 1.75, margin: 0 }}>
              Ao pausar, você não será cobrada nem receberá entregas até decidir retomar. Não há prazo — sua
              assinatura fica esperando por você pelo tempo que precisar. Se o próximo ciclo já estiver confirmado,
              ele ainda será entregue normalmente e a pausa começa a valer no ciclo seguinte.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, background: 'none', border: '1px solid #4B5740', color: '#4B5740', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                Voltar
              </button>
              <button onClick={confirmPause} disabled={busy} style={{ flex: 1, background: '#4B5740', color: '#FAF7F2', border: 'none', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                Confirmar pausa
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'cancel' && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(43,49,36,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#FAF7F2', maxWidth: 420, width: '100%', borderRadius: 2, padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#C4836A' }}>Cancelar assinatura</span>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 20, color: '#4B5740', margin: 0 }}>Tem certeza que deseja se despedir?</h3>
            <p style={{ fontSize: 13.5, color: '#5C5F51', lineHeight: 1.75, margin: 0 }}>
              Ao cancelar, sua assinatura termina de vez — não há entregas nem cobranças futuras. Se só precisa de
              um tempo, pausar pode ser a escolha mais gentil.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, background: 'none', border: '1px solid #4B5740', color: '#4B5740', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                Voltar
              </button>
              <button onClick={confirmCancel} disabled={busy} style={{ flex: 1, background: '#C4836A', color: '#FAF7F2', border: 'none', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
