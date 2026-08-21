'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CardPaymentBrick from '@/components/payment/CardPaymentBrick';
import InlineAddressForm from '@/components/address/InlineAddressForm';
import { createSubscription, checkFirstChargeStatus } from '@/app/assinatura/actions';
import { useScrollToTopOnChange } from '@/lib/hooks/useScrollToTopOnChange';
import type { Database, Freq, Size, Weekday } from '@/lib/supabase/types';

type Address = Database['public']['Tables']['addresses']['Row'];

const FREQS: Freq[] = ['Semanal', 'Quinzenal', 'Mensal'];
const SIZES: Size[] = ['P', 'M', 'G'];
const WEEKDAYS: Weekday[] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const btnBase: React.CSSProperties = { padding: '14px 24px', borderRadius: 2, border: '1px solid #4B5740', fontSize: 14, cursor: 'pointer' };
function optBtn(active: boolean): React.CSSProperties {
  return { ...btnBase, background: active ? '#4B5740' : 'transparent', color: active ? '#FAF7F2' : '#4B5740' };
}

/**
 * Fixed to the bottom of the viewport instead of flowing at the end of
 * each step's content — on shorter screens the old inline button row
 * could end up below the fold, indistinguishable from "nothing else
 * here" next to the floating WhatsApp bubble (also bottom-right, also a
 * round button) until you scrolled. This is always visible, always in
 * the same place, and its own shape/label makes it unmistakable from the
 * WhatsApp bubble regardless of content length. zIndex kept below the
 * WhatsApp button's (50) so that button still renders on top if the two
 * ever overlap on a narrow screen.
 */
function WizardFooter({ onBack, backLabel = '← Voltar', children }: { onBack?: () => void; backLabel?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: '#FAF7F2',
        borderTop: '1px solid rgba(75,87,64,0.15)',
        boxShadow: '0 -4px 16px rgba(75,87,64,0.08)',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {onBack ? (
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#7C7F6D', fontSize: 14, cursor: 'pointer' }}>
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        {children}
      </div>
    </div>
  );
}

export default function SubscriptionWizard({
  plans,
  addresses: initialAddresses,
  email,
}: {
  plans: Record<string, number>;
  addresses: Address[];
  email: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  useScrollToTopOnChange([step]);
  const [freq, setFreq] = useState<Freq>('Semanal');
  const [size, setSize] = useState<Size>('M');
  const [weekday, setWeekday] = useState<Weekday>('Quinta');
  const [message, setMessage] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.preferred)?.id ?? initialAddresses[0]?.id ?? '');
  const [showNewAddress, setShowNewAddress] = useState(addresses.length === 0);
  const [confirming, setConfirming] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  // Set once createSubscription succeeds — the Preapproval exists, but its
  // first charge's outcome isn't known synchronously (see
  // checkFirstChargeStatus). While this is set the wizard shows a "waiting
  // for confirmation" screen and polls instead of jumping straight to the
  // success screen.
  const [pendingDeliveryId, setPendingDeliveryId] = useState<string | null>(null);

  const price = plans[`${freq}-${size}`] ?? 0;
  const selectedAddress = addresses.find((a) => a.id === addressId);

  // Poll for the first charge's outcome once the Preapproval has been
  // created — mirrors CheckoutFlow's PIX polling.
  useEffect(() => {
    if (!pendingDeliveryId) return;
    const interval = setInterval(async () => {
      const result = await checkFirstChargeStatus(pendingDeliveryId);
      if (result.status === 'paid') {
        clearInterval(interval);
        setPendingDeliveryId(null);
        setStep(5);
      } else if (result.status === 'failed') {
        clearInterval(interval);
        setPendingDeliveryId(null);
        setDeclined(true);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingDeliveryId]);

  async function handleCardResult(result: { token: string }) {
    if (!addressId) {
      setFormError('Escolha um endereço.');
      return;
    }
    setFormError('');
    setConfirming(true);
    const res = await createSubscription({ freq, size, weekday, message, addressId, cardToken: result.token, recipientName: recipientName || undefined });
    setConfirming(false);
    if (res.declined) {
      setDeclined(true);
      return;
    }
    if (res.error) {
      if (res.error === 'Sessão expirada.') {
        router.push('/minha-conta?redirect=' + encodeURIComponent('/assinatura'));
        return;
      }
      setFormError(res.error);
      return;
    }
    setConfirmedId(res.subscriptionId ?? null);
    if (res.firstDeliveryId) {
      setPendingDeliveryId(res.firstDeliveryId);
    } else {
      // No delivery row came back (shouldn't normally happen) — fall back
      // to the success screen rather than polling forever on a null id.
      setStep(5);
    }
  }

  if (pendingDeliveryId) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '60px 0' }}>
        <div style={{ width: 44, height: 44, border: '3px solid #D8CFC0', borderTopColor: '#4B5740', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontStyle: 'italic', color: '#4B5740', margin: 0 }}>Confirmando sua assinatura…</h2>
        <p style={{ fontSize: 13.5, color: '#7C7F6D', maxWidth: 380 }}>Estamos confirmando a primeira cobrança com a sua operadora. Isso leva só alguns segundos.</p>
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '40px 0' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E8C4B8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4B5740" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontStyle: 'italic', color: '#4B5740', margin: 0 }}>Assinatura confirmada!</h2>
        <p style={{ fontSize: 13.5, color: '#4B5740', margin: 0 }}>
          {freq} · {size} · R$ {price} por ciclo
        </p>
        <p style={{ fontSize: 14, color: '#7C7F6D', maxWidth: 420 }}>
          Sua entrega já está a caminho, conforme a frequência {freq.toLowerCase()} escolhida. Gerencie, edite a
          mensagem ou pause quando quiser em Minha Conta.
        </p>
        <button onClick={() => router.push('/minha-conta?aba=assinatura')} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '14px 28px', borderRadius: 2, fontSize: 14, cursor: 'pointer' }}>
          Ir para Minha Conta
        </button>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 48 }}>
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              background: step === n ? '#4B5740' : 'transparent',
              color: step === n ? '#FAF7F2' : '#4B5740',
              border: '1px solid #4B5740',
            }}
          >
            {n}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#4B5740', margin: '0 0 16px' }}>Frequência</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {FREQS.map((f) => (
                <button key={f} onClick={() => setFreq(f)} style={optBtn(freq === f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#4B5740', margin: '0 0 16px' }}>Tamanho</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {SIZES.map((sz) => (
                <button key={sz} onClick={() => setSize(sz)} style={{ ...optBtn(size === sz), display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20 }}>{sz}</span>
                  <span style={{ fontSize: 12 }}>R$ {plans[`${freq}-${sz}`] ?? '—'}</span>
                </button>
              ))}
            </div>
          </div>
          <WizardFooter>
            <button onClick={() => setStep(2)} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '15px 30px', borderRadius: 2, fontSize: 14, cursor: 'pointer' }}>
              Continuar →
            </button>
          </WizardFooter>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#4B5740', margin: '0 0 12px' }}>Dia de entrega</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {WEEKDAYS.map((d) => (
                <button key={d} onClick={() => setWeekday(d)} style={{ ...optBtn(weekday === d), padding: '10px 16px', fontSize: 13 }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#4B5740', margin: '0 0 12px' }}>Mensagem do cartão</h3>
            <p style={{ fontSize: 13, color: '#8A8D7C', margin: '0 0 12px' }}>Você pode trocar essa mensagem antes de cada entrega.</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 180))}
              maxLength={180}
              placeholder="Escreva como se fosse um bilhete à mão…"
              style={{ width: '100%', minHeight: 110, padding: 16, border: '1px solid #D8CFC0', borderRadius: 2, fontFamily: "'Work Sans'", fontSize: 14, resize: 'vertical', background: '#FFFFFF' }}
            />
            <p style={{ fontSize: 11.5, color: '#A7AB97', margin: '6px 0 0', textAlign: 'right' }}>{message.length}/180</p>
          </div>
          <WizardFooter onBack={() => setStep(1)}>
            <button onClick={() => setStep(3)} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '15px 30px', borderRadius: 2, fontSize: 14, cursor: 'pointer' }}>
              Continuar →
            </button>
          </WizardFooter>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <label style={{ fontSize: 12.5, color: '#7C7F6D', display: 'block', marginBottom: 10 }}>Entregar em</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {addresses.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAddressId(a.id)}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
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
            </div>
            <button onClick={() => setShowNewAddress((v) => !v)} style={{ background: 'none', border: 'none', color: '#C4836A', fontSize: 13, cursor: 'pointer', marginTop: 12, padding: 0 }}>
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
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12.5, color: '#7C7F6D', display: 'block', marginBottom: 8 }}>
                Esta assinatura é um presente? Nome de quem vai receber (opcional)
              </label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value.slice(0, 60))}
                placeholder="Nome de quem vai receber"
                style={{ width: '100%', padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5 }}
              />
            </div>
          </div>

          {formError && <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0 }}>{formError}</p>}

          <WizardFooter onBack={() => setStep(2)}>
            <button
              onClick={() => setStep(4)}
              disabled={!addressId}
              style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '14px 28px', borderRadius: 2, fontSize: 14, cursor: 'pointer', opacity: !addressId ? 0.5 : 1 }}
            >
              Continuar →
            </button>
          </WizardFooter>
        </div>
      )}

      {step === 4 && (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* Same issue as CheckoutFlow's card step: the Brick's own
              "Pagar" button submits straight into handleCardResult, and
              without this the card fields just sat there for however long
              createSubscription took, looking broken instead of working. */}
          {confirming && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 30,
                background: 'rgba(250,247,242,0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
              }}
            >
              <div style={{ width: 34, height: 34, border: '3px solid #D8CFC0', borderTopColor: '#4B5740', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13.5, color: '#4B5740' }}>Confirmando assinatura…</span>
              <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
            </div>
          )}
          <div style={{ background: '#F3EDE3', padding: 34, borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Row label="Frequência" value={`${freq} · ${weekday}`} />
            <Row label="Tamanho" value={size} />
            <Row label="Endereço" value={selectedAddress ? `${selectedAddress.street}, ${selectedAddress.number}` : '—'} />
            {recipientName && <Row label="Presente para" value={recipientName} />}
            <Row label="Mensagem" value={message || '(sem mensagem)'} italic />
            <div style={{ height: 1, background: 'rgba(75,87,64,0.2)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontFamily: "'Playfair Display',serif", fontSize: 20, color: '#4B5740' }}>
              <span>Valor por ciclo</span>
              <strong>R$ {price}</strong>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: '#8A8D7C', lineHeight: 1.7 }}>
            Você pode ajustar, pausar ou cancelar sua assinatura a qualquer momento em Minha Conta.
          </p>

          <div>
            <label style={{ fontSize: 12.5, color: '#7C7F6D', display: 'block', marginBottom: 10 }}>Forma de pagamento</label>
            {/* No saved-card picker here — a subscription's card is always
                entered fresh, right here, and tokenized once for Mercado
                Pago's Preapproval to hold on to (never re-tokenized by us
                on each cycle). maxInstallments=1 hides the installment
                picker, since a cycle is never split into parcelas. */}
            <CardPaymentBrick
              amount={price}
              maxInstallments={1}
              payerEmail={email ?? undefined}
              notice={
                <>
                  <strong>Ao confirmar, sua assinatura é ativada</strong> e a primeira cobrança acontece agora,
                  neste cartão.
                </>
              }
              onResult={handleCardResult}
              onError={setFormError}
            />
          </div>

          {formError && <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0 }}>{formError}</p>}

          <WizardFooter onBack={() => setStep(3)}>
            {confirming && <span style={{ fontSize: 13, color: '#7C7F6D' }}>Confirmando…</span>}
          </WizardFooter>

          {declined && (
            <div onClick={() => setDeclined(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(43,49,36,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: '#FAF7F2', maxWidth: 420, width: '100%', borderRadius: 2, padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#C4836A' }}>Pagamento não aprovado</span>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 20, color: '#4B5740', margin: 0 }}>Algo não deu certo por aqui.</h3>
                <p style={{ fontSize: 13.5, color: '#5C5F51', lineHeight: 1.75, margin: 0 }}>
                  Não conseguimos confirmar a cobrança com o cartão informado. Sua assinatura ainda não foi ativada
                  — tente novamente com o mesmo cartão ou informe outro.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <button onClick={() => setDeclined(false)} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                    Tentar novamente
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, italic }: { label: string; value: string; italic?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 14, color: '#4B5740', flexWrap: 'wrap' }}>
      <span style={{ flexShrink: 0 }}>{label}</span>
      <strong style={{ maxWidth: 280, textAlign: 'right', fontStyle: italic ? 'italic' : 'normal', wordBreak: 'break-word' }}>{value}</strong>
    </div>
  );
}
