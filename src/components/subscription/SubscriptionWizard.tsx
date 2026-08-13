'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CardForm from '@/components/payment/CardForm';
import { createSubscription } from '@/app/assinatura/actions';
import type { Database, Freq, Size, Weekday } from '@/lib/supabase/types';

type Address = Database['public']['Tables']['addresses']['Row'];
type SavedCard = Database['public']['Tables']['saved_cards']['Row'];

const FREQS: Freq[] = ['Semanal', 'Quinzenal', 'Mensal'];
const SIZES: Size[] = ['P', 'M', 'G'];
const WEEKDAYS: Weekday[] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const btnBase: React.CSSProperties = { padding: '14px 24px', borderRadius: 2, border: '1px solid #4B5740', fontSize: 14, cursor: 'pointer' };
function optBtn(active: boolean): React.CSSProperties {
  return { ...btnBase, background: active ? '#4B5740' : 'transparent', color: active ? '#FAF7F2' : '#4B5740' };
}

export default function SubscriptionWizard({
  plans,
  addresses: initialAddresses,
  cards: initialCards,
}: {
  plans: Record<string, number>;
  addresses: Address[];
  cards: SavedCard[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [freq, setFreq] = useState<Freq>('Semanal');
  const [size, setSize] = useState<Size>('M');
  const [weekday, setWeekday] = useState<Weekday>('Quinta');
  const [message, setMessage] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [addresses, setAddresses] = useState(initialAddresses);
  const [cards, setCards] = useState(initialCards);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.preferred)?.id ?? initialAddresses[0]?.id ?? '');
  const [cardId, setCardId] = useState(initialCards[0]?.id ?? '');
  const [showNewAddress, setShowNewAddress] = useState(addresses.length === 0);
  const [showNewCard, setShowNewCard] = useState(cards.length === 0);
  const [confirming, setConfirming] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  const price = plans[`${freq}-${size}`] ?? 0;
  const selectedAddress = addresses.find((a) => a.id === addressId);

  async function handleConfirm() {
    if (!addressId || !cardId) {
      setFormError('Escolha um endereço e uma forma de pagamento.');
      return;
    }
    setFormError('');
    setConfirming(true);
    const result = await createSubscription({ freq, size, weekday, message, addressId, cardId, recipientName: recipientName || undefined });
    setConfirming(false);
    if (result.declined) {
      setDeclined(true);
      return;
    }
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setConfirmedId(result.subscriptionId ?? null);
    setStep(5);
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
    <div>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setStep(2)} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '15px 30px', borderRadius: 2, fontSize: 14, cursor: 'pointer' }}>
              Continuar →
            </button>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#7C7F6D', fontSize: 14, cursor: 'pointer' }}>
              ← Voltar
            </button>
            <button onClick={() => setStep(3)} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '15px 30px', borderRadius: 2, fontSize: 14, cursor: 'pointer' }}>
              Continuar →
            </button>
          </div>
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

          <div>
            <label style={{ fontSize: 12.5, color: '#7C7F6D', display: 'block', marginBottom: 10 }}>Forma de pagamento</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCardId(c.id)}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    border: `1.5px solid ${cardId === c.id ? '#4B5740' : '#D8CFC0'}`,
                    background: cardId === c.id ? '#F3EDE3' : '#FFFFFF',
                    borderRadius: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #4B5740', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {cardId === c.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4B5740' }} />}
                  </div>
                  <span style={{ fontSize: 13.5, color: '#4B5740' }}>
                    {c.brand} •••• {c.last4}
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowNewCard((v) => !v)} style={{ background: 'none', border: 'none', color: '#C4836A', fontSize: 13, cursor: 'pointer', marginTop: 12, padding: 0 }}>
              {showNewCard ? 'Cancelar' : '+ Adicionar cartão'}
            </button>
            {showNewCard && (
              <div style={{ marginTop: 10 }}>
                <CardForm
                  onTokenized={async (token) => {
                    const res = await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
                    const data = await res.json();
                    if (data.card) {
                      setCards((prev) => [...prev, data.card]);
                      setCardId(data.card.id);
                      setShowNewCard(false);
                    }
                  }}
                />
              </div>
            )}
            <p style={{ fontSize: 11.5, color: '#A7AB97', margin: '14px 0 0' }}>
              Assinaturas são cobradas por cartão de crédito, a cada ciclo, na data de corte de cada entrega.
            </p>
          </div>

          {formError && <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0 }}>{formError}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#7C7F6D', fontSize: 14, cursor: 'pointer' }}>
              ← Voltar
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!addressId || !cardId}
              style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '14px 28px', borderRadius: 2, fontSize: 14, cursor: 'pointer', opacity: !addressId || !cardId ? 0.5 : 1 }}
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(3)} style={{ background: 'none', border: 'none', color: '#7C7F6D', fontSize: 14, cursor: 'pointer' }}>
              ← Voltar
            </button>
            <button onClick={handleConfirm} disabled={confirming} style={{ background: '#C4836A', color: '#FAF7F2', border: 'none', padding: '15px 30px', borderRadius: 2, fontSize: 14, cursor: 'pointer' }}>
              {confirming ? 'Confirmando…' : 'Confirmar assinatura'}
            </button>
          </div>

          {declined && (
            <div onClick={() => setDeclined(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(43,49,36,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: '#FAF7F2', maxWidth: 420, width: '100%', borderRadius: 2, padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#C4836A' }}>Pagamento não aprovado</span>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 20, color: '#4B5740', margin: 0 }}>Algo não deu certo por aqui.</h3>
                <p style={{ fontSize: 13.5, color: '#5C5F51', lineHeight: 1.75, margin: 0 }}>
                  Não conseguimos confirmar a cobrança com o cartão selecionado. Sua assinatura ainda não foi
                  ativada — tente novamente ou use outro cartão.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <button onClick={() => setDeclined(false)} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                    Tentar novamente
                  </button>
                  <button
                    onClick={() => {
                      setDeclined(false);
                      setStep(3);
                      setShowNewCard(true);
                    }}
                    style={{ background: 'none', border: '1px solid #4B5740', color: '#4B5740', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}
                  >
                    Usar outro cartão
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

function InlineAddressForm({ onSaved }: { onSaved: (addr: Address) => void }) {
  const [cep, setCep] = useState('');
  const [resolvedStreet, setResolvedStreet] = useState('');
  const [resolving, setResolving] = useState(false);
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCepChange(value: string) {
    setCep(value);
    setResolvedStreet('');
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/cep?cep=${digits}`);
      if (!res.ok) {
        setError('CEP não encontrado.');
        return;
      }
      const data = await res.json();
      setResolvedStreet(`${data.street}, ${data.neighborhood} — ${data.city}/${data.state}`);
      setError('');
    } finally {
      setResolving(false);
    }
  }

  async function save() {
    if (!number.trim()) {
      setError('Informe o número.');
      return;
    }
    setSaving(true);
    const formData = new FormData();
    formData.set('cep', cep);
    formData.set('number', number);
    formData.set('complement', complement);
    const { addAddress } = await import('@/app/minha-conta/actions');
    const result = await addAddress(formData);
    setSaving(false);
    if (result?.error || !result?.address) {
      setError(result?.error || 'Não foi possível salvar o endereço.');
      return;
    }
    onSaved(result.address);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#F3EDE3', borderRadius: 2, marginTop: 10 }}>
      <input value={cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="CEP (obrigatório)" style={{ padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5, maxWidth: 160 }} />
      <input value={resolving ? 'Consultando…' : resolvedStreet} disabled placeholder="Endereço (preenchido pelo CEP)" style={{ padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5, background: '#F3EDE3', color: '#4B5740' }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={number} onChange={(e) => setNumber(e.target.value)} disabled={!resolvedStreet} placeholder="Número" style={{ flex: 1, padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5 }} />
        <input value={complement} onChange={(e) => setComplement(e.target.value)} disabled={!resolvedStreet} placeholder="Complemento (opcional)" style={{ flex: 2, padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5 }} />
      </div>
      {error && <p style={{ fontSize: 12, color: '#C4836A', margin: 0 }}>{error}</p>}
      <button onClick={save} disabled={!resolvedStreet || saving} style={{ alignSelf: 'flex-start', background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '11px 20px', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
        Salvar endereço
      </button>
    </div>
  );
}
