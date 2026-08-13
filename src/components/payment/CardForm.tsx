'use client';

import { useState } from 'react';

declare global {
  interface Window {
    MercadoPago: new (publicKey: string, opts?: { locale?: string }) => {
      createCardToken: (data: {
        cardNumber: string;
        cardholderName: string;
        cardExpirationMonth: string;
        cardExpirationYear: string;
        securityCode: string;
        identificationType: string;
        identificationNumber: string;
      }) => Promise<{ id: string }>;
    };
  }
}

let sdkLoadPromise: Promise<void> | null = null;

function loadMpSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar o Mercado Pago.'));
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

/**
 * Tokenizes a card entirely client-side via Mercado Pago's SDK (the card
 * number/CVV never touch our server — only the resulting single-use token
 * does). onTokenized should POST the token to a server route that attaches
 * it to the customer's Mercado Pago Customer and stores the card reference.
 */
export default function CardForm({
  onTokenized,
  onError,
  submitLabel = 'Salvar cartão',
}: {
  onTokenized: (token: string, meta: { name: string }) => Promise<void> | void;
  onError?: (message: string) => void;
  submitLabel?: string;
}) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const ready = number.replace(/\D/g, '').length >= 13 && name.trim() && cpf.replace(/\D/g, '').length === 11 && /^\d{2}\/\d{2}$/.test(expiry) && cvv.length >= 3;

  async function handleSubmit() {
    setError('');
    const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
    if (!publicKey) {
      const msg = 'Pagamento indisponível no momento.';
      setError(msg);
      onError?.(msg);
      return;
    }

    setSubmitting(true);
    try {
      await loadMpSdk();
      const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
      const [month, year] = expiry.split('/');
      const { id: token } = await mp.createCardToken({
        cardNumber: number.replace(/\D/g, ''),
        cardholderName: name,
        cardExpirationMonth: month,
        cardExpirationYear: `20${year}`,
        securityCode: cvv,
        identificationType: 'CPF',
        identificationNumber: cpf.replace(/\D/g, ''),
      });
      await onTokenized(token, { name });
    } catch {
      const msg = 'Não foi possível validar o cartão. Confira os dados e tente novamente.';
      setError(msg);
      onError?.(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = { padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#F3EDE3', borderRadius: 2 }}>
      <input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        maxLength={19}
        inputMode="numeric"
        placeholder="Número do cartão"
        style={inputStyle}
      />
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nome impresso no cartão" style={inputStyle} />
      <input value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={14} inputMode="numeric" placeholder="CPF do titular" style={inputStyle} />
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={expiry} onChange={(e) => setExpiry(e.target.value)} maxLength={5} inputMode="numeric" placeholder="MM/AA" style={{ ...inputStyle, flex: 1 }} />
        <input value={cvv} onChange={(e) => setCvv(e.target.value)} maxLength={4} inputMode="numeric" placeholder="CVV" style={{ ...inputStyle, flex: 1 }} />
      </div>
      {error && <p style={{ fontSize: 12, color: '#C4836A', margin: 0 }}>{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={!ready || submitting}
        style={{ alignSelf: 'flex-start', background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '11px 20px', borderRadius: 2, fontSize: 13, cursor: 'pointer', opacity: ready ? 1 : 0.5 }}
      >
        {submitting ? 'Validando…' : submitLabel}
      </button>
      <p style={{ fontSize: 11, color: '#A7AB97', margin: 0 }}>
        Seu número de cartão e CVV vão direto para o Mercado Pago — nunca passam pelos nossos servidores.
      </p>
    </div>
  );
}
