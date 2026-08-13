'use client';

import { useEffect, useState } from 'react';
import { CardPayment as CardPaymentMP, initMercadoPago } from '@mercadopago/sdk-react';

let mpInitialized = false;

export interface CardBrickResult {
  token: string;
  installments: number;
  paymentMethodId: string;
  issuerId: string;
}

/**
 * Wraps Mercado Pago's official Card Payment Brick. Card number/expiry/CVV
 * are entered into Mercado Pago's own secure iframed fields — never our
 * DOM, never our server. installments/payment_method_id/issuer_id come
 * back from Mercado Pago's real bin lookup against the entered card, not a
 * guessed interest formula.
 *
 * `onResult` decides what to do with the token: charge it once (avulso
 * checkout) or attach it to the customer's saved cards (assinatura). Set
 * maxInstallments to 1 for the latter — a recurring cycle is never split
 * into installments.
 */
export default function CardPaymentBrick({
  amount,
  maxInstallments = 1,
  payerEmail,
  notice,
  onResult,
  onError,
}: {
  amount: number;
  maxInstallments?: number;
  payerEmail?: string;
  /**
   * Optional line shown above the Brick's own submit button. Mercado Pago
   * renders that button itself (via a script loaded at runtime, not shipped
   * in this npm package), so its label can't be reliably overridden from
   * here — use `notice` wherever clicking it does something other than an
   * immediate charge (e.g. the subscription wizard's "save a card" step,
   * where the real charge only happens on a later, separate screen), so
   * the button's default "Pagar" label can't be mistaken for a second
   * payment.
   */
  notice?: string;
  onResult: (result: CardBrickResult) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const [ready, setReady] = useState(mpInitialized);
  const [initError, setInitError] = useState('');

  useEffect(() => {
    if (mpInitialized) {
      setReady(true);
      return;
    }
    const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
    if (!publicKey) {
      setInitError('Pagamento por cartão indisponível no momento.');
      onError?.('Pagamento por cartão indisponível no momento.');
      return;
    }
    initMercadoPago(publicKey, { locale: 'pt-BR' });
    mpInitialized = true;
    setReady(true);
    // Only ever runs the init side effect once per app load; onError is
    // intentionally excluded so a parent re-render doesn't re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initError) {
    return <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0 }}>{initError}</p>;
  }
  if (!ready || amount <= 0) return null;

  return (
    <div style={{ background: '#F3EDE3', padding: 16, borderRadius: 2 }}>
      {notice && (
        <p style={{ fontSize: 12, color: '#4B5740', background: '#FFFFFF', border: '1px solid #D8CFC0', borderRadius: 2, padding: '10px 12px', margin: '0 0 12px' }}>
          {notice}
        </p>
      )}
      <CardPaymentMP
        initialization={{ amount, payer: payerEmail ? { email: payerEmail } : undefined }}
        customization={{ paymentMethods: { maxInstallments } }}
        onSubmit={async (formData) => {
          await onResult({
            token: formData.token,
            installments: Number(formData.installments) || 1,
            paymentMethodId: formData.payment_method_id,
            issuerId: formData.issuer_id,
          });
        }}
        onError={(error) => {
          console.error('CardPayment Brick error', error);
          onError?.('Não foi possível validar o cartão. Confira os dados e tente novamente.');
        }}
      />
      <p style={{ fontSize: 11, color: '#A7AB97', marginTop: 10 }}>
        Seus dados de cartão vão direto para o Mercado Pago, em campos protegidos por ele — nunca passam pelos
        nossos servidores.
      </p>
    </div>
  );
}
