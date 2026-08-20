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
    const mintedAt = Date.now();
    const token = await mintTokenFromSavedCard(opts.mpCustomerId, opts.mpCardId);
    // Diagnostic only (not an error) -- token itself is masked (first 8
    // chars) since it's a live single-use credential. Logged so that if
    // this still 404s as "Card Token not found", we can see whether the
    // token minted looks sane and how much time passed before it was
    // used, instead of guessing.
    console.log('chargeSavedCard: token minted', {
      tokenPrefix: token?.slice(0, 8),
      mpCustomerId: opts.mpCustomerId,
      mpCardId: opts.mpCardId,
      mintToChargeMs: Date.now() - mintedAt,
    });
    const payment = new Payment(mpConfig());
    return await payment.create({
      body: {
        transaction_amount: opts.amount,
        token,
        description: opts.description,
        installments: opts.installments ?? 1,
        external_reference: opts.externalReference,
        // Reverted: a prior attempt dropped payer.type/payer.id here as an
        // untested hypothesis (matching chargeCardToken's plain {email}
        // payload). Real evidence says that was wrong, not just unproven --
        // with the field removed, the exact same card+customer that used to
        // fail as "Card Token not found" started failing instead as
        // "Customer not found" (cause[].code 2002). That's not a fluke:
        // this token comes from a *customer-vaulted* card (minted via
        // card_id+customer_id, unlike chargeCardToken's plain
        // card-entry token), so Mercado Pago needs payer.id to associate
        // the charge with that Customer. Restored it.
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

// ===================== Preapproval (recurring subscriptions) =====================
//
// Replaces the old chargeSavedCard-driven recurring model for subscription
// billing: instead of our own cron re-tokenizing a vaulted card_id every
// cycle (the mechanism that kept failing inconsistently -- 500s, "Card
// Token not found", "Customer not found", or a clean 200 that still came
// back declined, all for the identical request), Mercado Pago's Preapproval
// API owns the recurring schedule itself and charges the card on its own,
// notifying us via webhook. The very first charge still uses a token
// minted fresh from the card just entered (never a saved card_id), exactly
// like chargeCardToken -- there is no re-tokenization step anywhere in this
// flow, which is the actual point of migrating to it.

/**
 * back_url is a required field when creating a Preapproval, but it's only
 * ever used if the customer goes through Mercado Pago's own hosted
 * authorization redirect -- we don't use that (card_token_id is provided
 * directly, no redirect happens), so this just needs to be a valid URL.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://floreatelie.com.br';

/**
 * Creates a Preapproval: a recurring billing agreement Mercado Pago itself
 * drives. `cardTokenId` must be a fresh, single-use token minted directly
 * from the card just entered (the Card Payment Brick's own token) -- not a
 * saved card_id re-tokenized through /v1/card_tokens, which is the exact
 * mechanism this migration removes. `startDate` is when the *first* charge
 * fires; subsequent charges follow automatically every `frequencyDays`
 * days from there.
 */
export async function createPreapproval(opts: {
  payerEmail: string;
  cardTokenId: string;
  amount: number;
  frequencyDays: number;
  reason: string;
  externalReference: string;
  startDate: string; // 'YYYY-MM-DD'
}) {
  try {
    return await mpFetch('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: opts.reason,
        external_reference: opts.externalReference,
        payer_email: opts.payerEmail,
        card_token_id: opts.cardTokenId,
        back_url: `${SITE_URL}/assinatura`,
        status: 'authorized',
        auto_recurring: {
          frequency: opts.frequencyDays,
          frequency_type: 'days',
          transaction_amount: opts.amount,
          currency_id: 'BRL',
          start_date: `${opts.startDate}T00:00:00.000-03:00`,
        },
      }),
    });
  } catch (err) {
    logMpError('createPreapproval failed', err);
    throw err;
  }
}

/** Pauses, reactivates, or cancels a Preapproval -- e.g. pausing/cancelling
 * the subscription, or reactivating it on resume. Cancelling is permanent
 * on Mercado Pago's side (a cancelled Preapproval can't be reactivated;
 * resuming a cancelled subscription needs a brand new one). */
export async function updatePreapprovalStatus(preapprovalId: string, status: 'paused' | 'authorized' | 'cancelled') {
  try {
    return await mpFetch(`/preapproval/${preapprovalId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  } catch (err) {
    logMpError('updatePreapprovalStatus failed', err);
    throw err;
  }
}

/** Updates the amount charged on future cycles (a plan/size change). Does
 * not affect a cycle already charged. */
export async function updatePreapprovalAmount(preapprovalId: string, amount: number) {
  try {
    return await mpFetch(`/preapproval/${preapprovalId}`, {
      method: 'PUT',
      body: JSON.stringify({ auto_recurring: { transaction_amount: amount } }),
    });
  } catch (err) {
    logMpError('updatePreapprovalAmount failed', err);
    throw err;
  }
}

export async function getPreapproval(preapprovalId: string) {
  return mpFetch(`/preapproval/${preapprovalId}`, { method: 'GET' });
}

/**
 * Fetches the detail of a single recurring charge attempt Mercado Pago
 * generated on its own for a Preapproval (the resource the
 * `subscription_authorized_payment` webhook event refers to by id).
 * Expected fields (per Mercado Pago's docs — NOT yet exercised against a
 * real webhook payload, since this whole flow is still untested with real
 * credentials; verify shape against the first real event received):
 * `preapproval_id`, `status` ('scheduled' | 'pending' | 'processed' |
 * 'rejected' | 'cancelled'), and a nested `payment` object with the
 * underlying payment's own `id`/`status` once one exists.
 */
export async function getAuthorizedPayment(authorizedPaymentId: string) {
  return mpFetch(`/authorized_payments/${authorizedPaymentId}`, { method: 'GET' });
}

export { CardToken };
