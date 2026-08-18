import 'server-only';
import { MercadoPagoConfig, CardToken, Payment } from 'mercadopago';

/**
 * Server-side Mercado Pago SDK client. Uses MERCADOPAGO_ACCESS_TOKEN — never
 * expose this token to the browser. The browser only ever talks to Mercado
 * Pago with the public key (see src/components/payment/CardPaymentBrick.tsx),
 * via the official Card Payment Brick — card number/CVV are entered into
 * Mercado Pago's own secure iframed fields and never touch our DOM or our
 * server, only the resulting single-use token does.
 */
function mpConfig() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado.');
  return new MercadoPagoConfig({ accessToken });
}

/**
 * Logs the real Mercado Pago error detail before a caller's try/catch
 * flattens it into a generic "declined" outcome for the customer.
 *
 * Uses JSON.stringify instead of handing the object straight to
 * console.error: Node's default object inspection (and Vercel's log
 * viewer on top of it) truncates nested objects past a shallow depth,
 * which repeatedly hid the one field that actually mattered — Mercado
 * Pago puts the specific rejection/validation reason inside
 * mpBody.cause[], and that's exactly what was printing as a bare
 * "[Object]" with no way to expand it. Plain JSON has no depth limit.
 */
export function logMpError(context: string, err: unknown) {
  const detail = err instanceof Error ? { message: err.message, mpBody: (err as Error & { mpBody?: unknown }).mpBody } : err;
  console.error(context, JSON.stringify(detail, null, 2));
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

/**
 * Finds (or creates) the one Mercado Pago Customer for a Florê customer.
 *
 * Mercado Pago's Customers API enforces one customer per email per
 * application — creating a second one for an email that already has a
 * Customer fails with cause[].code === '101' ("the customer already
 * exist") instead of just handing back the existing id. That happens
 * whenever our own stored mp_customer_id is missing or was reset (a
 * previous attempt half-succeeded, we cleared it while chasing a stale
 * reference, etc.) but Mercado Pago itself still has a real Customer for
 * that email — so on that specific error, look the existing one up by
 * email and reuse it instead of failing forever for that email.
 */
export async function ensureMpCustomer(opts: { existingMpCustomerId: string | null; email: string; name?: string | null }) {
  if (opts.existingMpCustomerId) return opts.existingMpCustomerId;

  try {
    const created = await mpFetch('/v1/customers', {
      method: 'POST',
      body: JSON.stringify({ email: opts.email, first_name: opts.name || undefined }),
    });
    return created.id as string;
  } catch (err) {
    const mpBody = (err as Error & { mpBody?: { cause?: { code?: string }[] } }).mpBody;
    const alreadyExists = mpBody?.cause?.some((c) => c.code === '101');
    if (!alreadyExists) throw err;

    const found = await mpFetch(`/v1/customers/search?email=${encodeURIComponent(opts.email)}`, { method: 'GET' });
    const existingId = found?.results?.[0]?.id as string | undefined;
    if (!existingId) throw err;
    return existingId;
  }
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

/**
 * Detaches (deletes) a card from a Mercado Pago Customer. Written as a plain
 * fetch instead of mpFetch because this endpoint's success response isn't
 * guaranteed to be JSON — mpFetch's unconditional res.json() would throw on
 * an empty body, and the caller only ever needs to know pass/fail here.
 */
export async function detachCardFromCustomer(mpCustomerId: string, mpCardId: string) {
  const res = await fetch(`${MP_API_BASE}/v1/customers/${mpCustomerId}/cards/${mpCardId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(body?.message || 'Erro ao remover cartão na Mercado Pago');
    (err as Error & { mpBody?: unknown }).mpBody = body;
    throw err;
  }
}

/**
 * Mints a fresh, single-use card token from a card already vaulted on a
 * Customer (via attachCardToCustomer). This is the step chargeSavedCard was
 * missing: Mercado Pago's Payments resource does not accept a bare
 * `card_id` — a stored card can only be charged through a token minted
 * specifically for that charge, via this separate endpoint.
 */
async function mintTokenFromSavedCard(mpCustomerId: string, mpCardId: string): Promise<string> {
  const result = await mpFetch('/v1/card_tokens', {
    method: 'POST',
    body: JSON.stringify({ card_id: mpCardId, customer_id: mpCustomerId }),
  });
  return result.id as string;
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
  try {
    const token = await mintTokenFromSavedCard(opts.mpCustomerId, opts.mpCardId);
    const payment = new Payment(mpConfig());
    return await payment.create({
      body: {
        transaction_amount: opts.amount,
        token,
        description: opts.description,
        installments: opts.installments ?? 1,
        external_reference: opts.externalReference,
        payer: { email: opts.payerEmail, type: 'customer', id: opts.mpCustomerId },
      },
    });
  } catch (err) {
    // Surfaced so a broken request (bad token, malformed body, MP outage)
    // is distinguishable in the logs from a genuine card decline — the
    // caller still treats both as "declined" for the customer-facing
    // message, but only one of those should ever actually happen.
    logMpError('chargeSavedCard failed', err);
    throw err;
  }
}

/**
 * Charges a brand-new client-side card token (avulso checkout). token,
 * installments, paymentMethodId and issuerId all come straight out of the
 * Card Payment Brick's onSubmit callback — installments in particular
 * reflects the real rate the issuer quoted for that specific card (via
 * Mercado Pago's own bin lookup), not a guessed formula.
 */
export async function chargeCardToken(opts: {
  token: string;
  amount: number;
  description: string;
  installments?: number;
  paymentMethodId?: string;
  issuerId?: string;
  externalReference: string;
  payerEmail: string;
}) {
  const payment = new Payment(mpConfig());
  try {
    return await payment.create({
      body: {
        transaction_amount: opts.amount,
        token: opts.token,
        description: opts.description,
        installments: opts.installments ?? 1,
        payment_method_id: opts.paymentMethodId,
        issuer_id: opts.issuerId ? Number(opts.issuerId) : undefined,
        external_reference: opts.externalReference,
        payer: { email: opts.payerEmail },
      },
    });
  } catch (err) {
    logMpError('chargeCardToken failed', err);
    throw err;
  }
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
  let result;
  try {
    result = await payment.create({
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
  } catch (err) {
    logMpError('createPixPayment failed', err);
    throw err;
  }
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
