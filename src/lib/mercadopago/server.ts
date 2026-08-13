import 'server-only';
import { MercadoPagoConfig, CardToken, Payment } from 'mercadopago';

/**
 * Server-side Mercado Pago SDK client. Uses MERCADOPAGO_ACCESS_TOKEN — never
 * expose this token to the browser. The browser only ever talks to Mercado
 * Pago with the public key (see src/components/payment/CardForm.tsx), which
 * can only mint single-use card tokens, nothing account-level.
 */
function mpConfig() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado.');
  return new MercadoPagoConfig({ accessToken });
}

const MP_API_BASE = 'https://api.mercadopago.com';

async function mpFetch(path: string, init: RequestInit) {
  const res = await fetch(`${MP_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body?.message || 'Erro na Mercado Pago API');
    (err as Error & { mpBody?: unknown }).mpBody = body;
    throw err;
  }
  return body;
}

/** Finds (or creates) the one Mercado Pago Customer for a Florê customer. */
export async function ensureMpCustomer(opts: { existingMpCustomerId: string | null; email: string; name?: string | null }) {
  if (opts.existingMpCustomerId) return opts.existingMpCustomerId;

  const created = await mpFetch('/v1/customers', {
    method: 'POST',
    body: JSON.stringify({ email: opts.email, first_name: opts.name || undefined }),
  });
  return created.id as string;
}

/** Attaches a single-use card token (minted client-side) to a Mercado Pago Customer. */
export async function attachCardToCustomer(mpCustomerId: string, cardToken: string) {
  const card = await mpFetch(`/v1/customers/${mpCustomerId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ token: cardToken }),
  });
  return {
    mpCardId: card.id as string,
    brand: card.payment_method?.name as string | undefined,
    last4: card.last_four_digits as string | undefined,
    cardholderName: card.cardholder?.name as string | undefined,
  };
}

/** Charges a saved card (customer_id + card_id) for a subscription cycle or an avulso order. */
export async function chargeSavedCard(opts: {
  mpCustomerId: string;
  mpCardId: string;
  amount: number;
  description: string;
  installments?: number;
  externalReference: string;
  payerEmail: string;
}) {
  const payment = new Payment(mpConfig());
  const result = await payment.create({
    body: {
      transaction_amount: opts.amount,
      description: opts.description,
      installments: opts.installments ?? 1,
      payment_method_id: undefined,
      token: undefined,
      external_reference: opts.externalReference,
      payer: { email: opts.payerEmail, type: 'customer', id: opts.mpCustomerId },
      // Charging a previously-saved card by id, per Mercado Pago's
      // "cobrar cartão salvo" flow.
      // @ts-expect-error -- card_id isn't in the SDK's TS payload type yet, but is accepted by the API.
      card_id: opts.mpCardId,
    },
  });
  return result;
}

/** Charges a brand-new client-side card token (avulso checkout, first subscription cycle). */
export async function chargeCardToken(opts: {
  token: string;
  amount: number;
  description: string;
  installments?: number;
  externalReference: string;
  payerEmail: string;
}) {
  const payment = new Payment(mpConfig());
  return payment.create({
    body: {
      transaction_amount: opts.amount,
      token: opts.token,
      description: opts.description,
      installments: opts.installments ?? 1,
      external_reference: opts.externalReference,
      payer: { email: opts.payerEmail },
    },
  });
}

/**
 * Creates a PIX payment. Mercado Pago returns a QR code (image + the
 * "copia e cola" string) immediately; the payment itself only settles once
 * the customer actually pays, which we find out either via the webhook
 * (see /api/webhooks/mercadopago) or by polling getPaymentStatus.
 */
export async function createPixPayment(opts: {
  amount: number;
  description: string;
  externalReference: string;
  payerEmail: string;
  payerFirstName?: string;
  payerCpf?: string;
}) {
  const payment = new Payment(mpConfig());
  const result = await payment.create({
    body: {
      transaction_amount: opts.amount,
      description: opts.description,
      payment_method_id: 'pix',
      external_reference: opts.externalReference,
      payer: {
        email: opts.payerEmail,
        first_name: opts.payerFirstName,
        identification: opts.payerCpf ? { type: 'CPF', number: opts.payerCpf } : undefined,
      },
    },
  });
  return {
    id: result.id,
    status: result.status,
    qrCodeBase64: result.point_of_interaction?.transaction_data?.qr_code_base64,
    qrCode: result.point_of_interaction?.transaction_data?.qr_code,
    expiresAt: result.date_of_expiration,
  };
}

export async function getPaymentStatus(paymentId: string | number) {
  const payment = new Payment(mpConfig());
  const result = await payment.get({ id: paymentId });
  return result.status;
}

export { CardToken };
