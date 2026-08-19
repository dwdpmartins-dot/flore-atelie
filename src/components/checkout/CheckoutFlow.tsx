'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart/CartContext';
import CardPaymentBrick, { type CardBrickResult } from '@/components/payment/CardPaymentBrick';
import InlineAddressForm from '@/components/address/InlineAddressForm';
import { updateProfile } from '@/app/minha-conta/actions';
import { payAvulsoOrder, checkPixStatus } from '@/app/checkout/actions';
import { upcomingDeliverableDates, todayISO } from '@/lib/delivery/holidays';
import { useScrollToTopOnChange } from '@/lib/hooks/useScrollToTopOnChange';
import type { Database } from '@/lib/supabase/types';

function formatDeliveryDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type Customer = Database['public']['Tables']['customers']['Row'];
type Address = Database['public']['Tables']['addresses']['Row'];
type SavedCard = Database['public']['Tables']['saved_cards']['Row'];

export default function CheckoutFlow({
  customer,
  email,
  addresses: initialAddresses,
  cards: initialCards,
}: {
  customer: Customer | null;
  email: string | null;
  addresses: Address[];
  cards: SavedCard[];
}) {
  const router = useRouter();
  const { cart, cartTotal, removeFromCart, updateQty, clearCart } = useCart();
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState('');

  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [editingContact, setEditingContact] = useState(!customer?.name || !customer?.phone);

  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.preferred)?.id ?? initialAddresses[0]?.id ?? '');
  const [showNewAddress, setShowNewAddress] = useState(initialAddresses.length === 0);
  const [shippingFee, setShippingFee] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [period, setPeriod] = useState<'manha' | 'tarde'>('manha');
  // Delivery date: tomorrow at the earliest, within the next 7 days, no
  // Sundays/holidays (see lib/delivery/holidays.ts). Computed client-side
  // for the picker's options, but payAvulsoOrder recomputes and validates
  // this same window server-side before charging anything — never trust a
  // client-submitted date, same reasoning as the shipping fee.
  const deliveryDateOptions = upcomingDeliverableDates(todayISO(), 1, 7);
  const [deliveryDate, setDeliveryDate] = useState(deliveryDateOptions[0] ?? '');

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');
  const [cards, setCards] = useState(initialCards);
  const [cardId, setCardId] = useState(initialCards[0]?.id ?? '');
  const [showNewCard, setShowNewCard] = useState(initialCards.length === 0);

  const [submitting, setSubmitting] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState('');
  const [pixData, setPixData] = useState<{ qrCodeBase64?: string; qrCode?: string; orderId: string } | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  // step/pixData/confirmedOrderId each gate a completely different-height
  // view (the multi-field form vs. the QR code screen vs. the short
  // "pedido confirmado" message) — without this, advancing past a tall
  // step left the viewport at the old scroll offset, usually landing on
  // the footer instead of the new (much shorter) view.
  useScrollToTopOnChange([step, pixData, confirmedOrderId]);

  const selectedAddress = addresses.find((a) => a.id === addressId);
  const total = cartTotal + (shippingFee ?? 0);

  useEffect(() => {
    if (!selectedAddress) {
      setShippingFee(null);
      return;
    }
    fetch(`/api/cep?cep=${selectedAddress.cep}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setShippingFee(data.shippingFee ?? 30);
          setDistanceKm(data.distanceKm ?? null);
        }
      });
  }, [selectedAddress]);

  // Poll for PIX confirmation.
  useEffect(() => {
    if (!pixData) return;
    const interval = setInterval(async () => {
      const result = await checkPixStatus(pixData.orderId);
      if (result.status === 'approved') {
        clearInterval(interval);
        clearCart();
        setConfirmedOrderId(pixData.orderId);
        setStep(4);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pixData, clearCart]);

  async function saveContact() {
    const fd = new FormData();
    fd.set('name', name);
    fd.set('nickname', customer?.nickname ?? '');
    fd.set('phone', phone);
    await updateProfile(fd);
    setEditingContact(false);
  }

  /**
   * Handles both submit paths: the bottom "Confirmar pagamento" button
   * (saved card or PIX) and the Card Payment Brick's own submit button
   * (brand-new card — newCard carries the token + real installments/
   * payment_method_id/issuer_id straight out of Mercado Pago).
   */
  async function submitOrder(newCard?: CardBrickResult) {
    setError('');

    if (!deliveryDate) {
      setError('Escolha uma data de entrega.');
      return;
    }

    if (paymentMethod === 'card' && !cardId && !newCard) {
      setError('Preencha os dados do cartão.');
      return;
    }

    setSubmitting(true);
    const result = await payAvulsoOrder({
      items: cart,
      message,
      addressId,
      deliveryDate,
      deliveryPeriod: period,
      paymentMethod,
      cardId: paymentMethod === 'card' && !newCard ? cardId : undefined,
      newCardToken: newCard?.token,
      installments: newCard?.installments,
      paymentMethodId: newCard?.paymentMethodId,
      issuerId: newCard?.issuerId,
    });
    setSubmitting(false);

    if ('declined' in result && result.declined) {
      setDeclined(true);
      return;
    }
    if ('error' in result && result.error) {
      if (result.error === 'Sessão expirada.') {
        router.push('/minha-conta?redirect=' + encodeURIComponent('/checkout'));
        return;
      }
      setError(result.error);
      return;
    }
    if ('pix' in result && result.pix) {
      setPixData({ ...result.pix, orderId: result.orderId });
      return;
    }
    if ('success' in result && result.success) {
      clearCart();
      setConfirmedOrderId(result.orderId);
      setStep(4);
    }
  }

  if (step === 4 || confirmedOrderId) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '30px 0' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E8C4B8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4B5740" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontStyle: 'italic', color: '#4B5740', margin: 0 }}>Pedido confirmado</h2>
        <p style={{ fontSize: 14, color: '#7C7F6D', maxWidth: 400 }}>
          Total pago: R$ {total.toFixed(2)}. Vamos preparar tudo com carinho e avisar quando saírmos para entrega.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => router.push('/minha-conta?aba=pedidos')} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '14px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
            Ver meus pedidos
          </button>
          <Link href="/" style={{ background: 'none', border: '1px solid #4B5740', color: '#4B5740', padding: '14px 24px', borderRadius: 2, fontSize: 13 }}>
            Voltar à home
          </Link>
        </div>
      </div>
    );
  }

  if (pixData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '20px 0' }}>
        {pixData.qrCodeBase64 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" width={220} height={220} style={{ border: '1px solid #D8CFC0' }} />
        )}
        <p style={{ fontSize: 12.5, color: '#7C7F6D' }}>Escaneie o QR ou copie o código PIX abaixo.</p>
        {pixData.qrCode && (
          <textarea
            readOnly
            value={pixData.qrCode}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            style={{ width: '100%', maxWidth: 420, minHeight: 70, padding: 10, fontSize: 11, border: '1px solid #D8CFC0', borderRadius: 2 }}
          />
        )}
        <p style={{ fontSize: 11, color: '#A7AB97', margin: 0 }}>Aguardando confirmação do pagamento…</p>
      </div>
    );
  }

  if (step === 1) {
    if (cart.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <p style={{ fontSize: 14, color: '#7C7F6D', fontStyle: 'italic' }}>Seu carrinho ainda espera pela primeira flor.</p>
          <Link href="/catalogo" style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '13px 24px', borderRadius: 2, fontSize: 13 }}>
            Ver catálogo
          </Link>
        </div>
      );
    }
    return (
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 26 }}>
          {cart.map((c) => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 16, background: '#FFFFFF', borderRadius: 2, boxShadow: '0 1px 3px rgba(75,87,64,0.06)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, color: '#4B5740' }}>{c.label}</div>
                <div style={{ fontSize: 11, color: '#8A8D7C' }}>{c.kind}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => updateQty(c.key, c.qty - 1)} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #C9CBB8', background: 'none', cursor: 'pointer' }}>
                  −
                </button>
                <span style={{ fontSize: 13 }}>{c.qty}</span>
                <button onClick={() => updateQty(c.key, c.qty + 1)} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #C9CBB8', background: 'none', cursor: 'pointer' }}>
                  +
                </button>
              </div>
              <span style={{ width: 70, textAlign: 'right', fontSize: 13.5, color: '#4B5740' }}>R$ {(c.price * c.qty).toFixed(2)}</span>
              <button onClick={() => removeFromCart(c.key)} style={{ background: 'none', border: 'none', color: '#C4836A', cursor: 'pointer', fontSize: 12 }}>
                Remover
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12.5, color: '#7C7F6D', display: 'block', marginBottom: 8 }}>Mensagem para o cartão (opcional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 180))}
            maxLength={180}
            placeholder="Escreva como se fosse um bilhete à mão…"
            style={{ width: '100%', minHeight: 80, padding: 14, border: '1px solid #D8CFC0', borderRadius: 2, fontFamily: "'Work Sans'", fontSize: 13.5, resize: 'vertical', background: '#FFFFFF' }}
          />
          <p style={{ fontSize: 11, color: '#A7AB97', margin: '4px 0 0', textAlign: 'right' }}>{message.length}/180</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#4B5740', paddingTop: 14, borderTop: '1px solid rgba(75,87,64,0.12)', marginBottom: 24 }}>
          <span>Subtotal</span>
          <strong>R$ {cartTotal.toFixed(2)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setStep(2)} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '14px 28px', borderRadius: 2, fontSize: 14, cursor: 'pointer' }}>
            Continuar →
          </button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    const canContinue = name.trim() && phone.trim() && addressId;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <label style={{ fontSize: 12.5, color: '#7C7F6D', display: 'block', marginBottom: 10 }}>Seus dados de contato</label>
          {!editingContact ? (
            <div style={{ padding: '14px 16px', background: '#FFFFFF', borderRadius: 2, border: '1px solid #D8CFC0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13.5, color: '#4B5740' }}>{name}</div>
                <div style={{ fontSize: 12.5, color: '#8A8D7C' }}>{phone}</div>
              </div>
              <button onClick={() => setEditingContact(true)} style={{ background: 'none', border: 'none', color: '#C4836A', fontSize: 12.5, cursor: 'pointer' }}>
                Editar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nome completo" style={{ padding: 14, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 14 }} />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={saveContact}
                maxLength={15}
                inputMode="numeric"
                placeholder="WhatsApp / celular"
                style={{ padding: 14, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 14 }}
              />
              <p style={{ fontSize: 11, color: '#A7AB97', margin: 0 }}>Usamos para confirmar entregas e ajustes de última hora. Preenchido uma vez, fica salvo na sua conta.</p>
            </div>
          )}
        </div>

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
                  <div style={{ fontSize: 13.5, color: '#4B5740', fontWeight: 500 }}>
                    {a.label}
                    {a.preferred && <span style={{ fontSize: 10.5, color: '#C4836A', fontWeight: 400, marginLeft: 8 }}>· Padrão</span>}
                  </div>
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
            <div style={{ marginTop: 14 }}>
              <InlineAddressForm
                onSaved={(addr) => {
                  setAddresses((prev) => [...prev, addr]);
                  setAddressId(addr.id);
                  setShowNewAddress(false);
                }}
              />
            </div>
          )}
        </div>

        {distanceKm != null && (
          <label style={{ fontSize: 12.5, color: '#7C7F6D' }}>
            Distância estimada até você: {distanceKm} km <span style={{ color: '#A7AB97' }}>(calculada pelo CEP do endereço selecionado)</span>
          </label>
        )}

        <div>
          <label style={{ fontSize: 12.5, color: '#7C7F6D', display: 'block', marginBottom: 10 }}>Data de entrega</label>
          <select
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            style={{ width: '100%', padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5, background: '#FFFFFF', color: '#4B5740' }}
          >
            {deliveryDateOptions.map((d) => (
              <option key={d} value={d}>
                {formatDeliveryDate(d)}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11.5, color: '#A7AB97', margin: '6px 0 0' }}>
            Entregamos de segunda a sábado. Escolha a data com pelo menos 1 dia de antecedência.
          </p>
        </div>

        <div>
          <label style={{ fontSize: 12.5, color: '#7C7F6D', display: 'block', marginBottom: 10 }}>Período de entrega (horário comercial)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setPeriod('manha')}
              style={{ flex: 1, padding: 12, border: '1px solid #4B5740', background: period === 'manha' ? '#4B5740' : 'transparent', color: period === 'manha' ? '#FAF7F2' : '#4B5740', borderRadius: 2, fontSize: 13.5, cursor: 'pointer' }}
            >
              Manhã (9h–12h)
            </button>
            <button
              onClick={() => setPeriod('tarde')}
              style={{ flex: 1, padding: 12, border: '1px solid #4B5740', background: period === 'tarde' ? '#4B5740' : 'transparent', color: period === 'tarde' ? '#FAF7F2' : '#4B5740', borderRadius: 2, fontSize: 13.5, cursor: 'pointer' }}
            >
              Tarde (13h–18h)
            </button>
          </div>
        </div>

        <div style={{ background: '#F3EDE3', padding: '18px 20px', borderRadius: 2, display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#4B5740' }}>
          <span>Frete estimado</span>
          <strong>R$ {shippingFee != null ? shippingFee.toFixed(2) : '—'}</strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#7C7F6D', fontSize: 14, cursor: 'pointer' }}>
            ← Voltar
          </button>
          <button
            onClick={() => setStep(3)}
            disabled={!canContinue}
            style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '14px 28px', borderRadius: 2, fontSize: 14, cursor: 'pointer', opacity: canContinue ? 1 : 0.5 }}
          >
            Continuar →
          </button>
        </div>
        {!canContinue && <p style={{ fontSize: 11.5, color: '#C4836A', margin: '-14px 0 0', textAlign: 'right' }}>Nome, WhatsApp e um endereço com CEP são obrigatórios para continuar.</p>}
      </div>
    );
  }

  // step 3
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => setPaymentMethod('card')}
          style={{ flex: 1, padding: 14, border: '1px solid #4B5740', borderRadius: 2, background: paymentMethod === 'card' ? '#4B5740' : 'transparent', color: paymentMethod === 'card' ? '#FAF7F2' : '#4B5740', cursor: 'pointer', fontSize: 13 }}
        >
          Cartão de crédito
        </button>
        <button
          onClick={() => setPaymentMethod('pix')}
          style={{ flex: 1, padding: 14, border: '1px solid #4B5740', borderRadius: 2, background: paymentMethod === 'pix' ? '#4B5740' : 'transparent', color: paymentMethod === 'pix' ? '#FAF7F2' : '#4B5740', cursor: 'pointer', fontSize: 13 }}
        >
          PIX
        </button>
      </div>

      {paymentMethod === 'card' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCardId(c.id);
                setShowNewCard(false);
              }}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                border: `1.5px solid ${cardId === c.id && !showNewCard ? '#4B5740' : '#D8CFC0'}`,
                background: cardId === c.id && !showNewCard ? '#F3EDE3' : '#FFFFFF',
                borderRadius: 2,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #4B5740', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {cardId === c.id && !showNewCard && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4B5740' }} />}
              </div>
              <span style={{ fontSize: 13.5, color: '#4B5740' }}>
                {c.brand} •••• {c.last4}
              </span>
            </button>
          ))}
          <button onClick={() => setShowNewCard((v) => !v)} style={{ background: 'none', border: 'none', color: '#C4836A', fontSize: 13, cursor: 'pointer', marginTop: 4, padding: 0, textAlign: 'left' }}>
            {showNewCard ? 'Cancelar' : '+ Adicionar cartão'}
          </button>
          {showNewCard && (
            <CardPaymentBrick
              amount={total}
              maxInstallments={6}
              payerEmail={email ?? undefined}
              onResult={(result) => submitOrder(result)}
              onError={setError}
            />
          )}
        </div>
      )}

      {paymentMethod === 'pix' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '20px 0' }}>
          <p style={{ fontSize: 12.5, color: '#7C7F6D', textAlign: 'center' }}>
            O QR Code para pagamento é gerado ao confirmar o pedido, e expira em alguns minutos.
          </p>
        </div>
      )}

      <div style={{ background: '#F3EDE3', padding: '18px 20px', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#4B5740' }}>
          <span>Buquê/Assinatura</span>
          <span>R$ {cartTotal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#4B5740' }}>
          <span>Frete</span>
          <span>R$ {(shippingFee ?? 0).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Playfair Display',serif", fontSize: 19, color: '#4B5740', paddingTop: 8, borderTop: '1px solid rgba(75,87,64,0.15)' }}>
          <span>Total</span>
          <strong>R$ {total.toFixed(2)}</strong>
        </div>
      </div>

      {error && <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#7C7F6D', fontSize: 14, cursor: 'pointer' }}>
          ← Voltar
        </button>
        {/* When adding a brand-new card, the Card Payment Brick above has
            its own "Pagar" button (its onSubmit is what calls submitOrder) —
            showing this one too would mean two submit buttons for one step. */}
        {!(paymentMethod === 'card' && showNewCard) && (
          <button onClick={() => submitOrder()} disabled={submitting} style={{ background: '#C4836A', color: '#FAF7F2', border: 'none', padding: '15px 30px', borderRadius: 2, fontSize: 14, cursor: 'pointer' }}>
            {submitting ? 'Confirmando…' : 'Confirmar pagamento'}
          </button>
        )}
      </div>

      {declined && (
        <div onClick={() => setDeclined(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(43,49,36,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#FAF7F2', maxWidth: 420, width: '100%', borderRadius: 2, padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#C4836A' }}>Pagamento não aprovado</span>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 20, color: '#4B5740', margin: 0 }}>Algo não deu certo por aqui.</h3>
            <p style={{ fontSize: 13.5, color: '#5C5F51', lineHeight: 1.75, margin: 0 }}>
              Não conseguimos confirmar o pagamento com o cartão selecionado. Seu pedido não foi finalizado — tente
              novamente, use outro cartão, ou troque a forma de pagamento.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <button onClick={() => setDeclined(false)} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                Tentar novamente
              </button>
              <button
                onClick={() => {
                  setDeclined(false);
                  setShowNewCard(true);
                  setCardId('');
                }}
                style={{ background: 'none', border: '1px solid #4B5740', color: '#4B5740', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}
              >
                Usar outro cartão
              </button>
              <button
                onClick={() => {
                  setDeclined(false);
                  setPaymentMethod('pix');
                }}
                style={{ background: 'none', border: '1px solid #4B5740', color: '#4B5740', padding: 12, borderRadius: 2, fontSize: 13, cursor: 'pointer' }}
              >
                Trocar para PIX
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
