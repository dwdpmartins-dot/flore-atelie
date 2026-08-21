import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthorizedPayment } from '@/lib/mercadopago/server';
import { applyPendingTransition } from '@/lib/subscriptions/billing';

export const runtime = 'nodejs';

/**
 * Mercado Pago webhook — the async counterpart to the polling in
 * checkPixStatus (PIX approvals, and any card status changes that happen
 * after the initial charge, e.g. a late fraud-review reversal).
 *
 * Verifies the x-signature header when MERCADOPAGO_WEBHOOK_SECRET is set
 * (see https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks#editor_5).
 */
function verifySignature(request: Request, rawBody: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true; // not configured yet — accept, but see note below.

  const signatureHeader = request.headers.get('x-signature') || '';
  const requestId = request.headers.get('x-request-id') || '';
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.trim().split('=')));
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const url = new URL(request.url);
  const dataId = url.searchParams.get('data.id') || '';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  void rawBody;
  return expected === v1;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const admin = createAdminClient();

  if (!verifySignature(request, rawBody)) {
    await admin.from('webhook_events').insert({ provider: 'mercadopago', event_type: 'invalid_signature', payload: { rawBody } });
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 });
  }

  let body: { type?: string; data?: { id?: string } } = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Mercado Pago also sends the payment id as a query param on some event
    // shapes; fall through and let the id-lookup below handle it.
  }

  const url = new URL(request.url);
  const paymentId = body.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
  const eventType = body.type || url.searchParams.get('type') || 'unknown';

  await admin.from('webhook_events').insert({ provider: 'mercadopago', event_type: eventType, payload: body });

  // Recurring Preapproval charges — Mercado Pago charges the card on its
  // own schedule and tells us the outcome here instead of us driving it via
  // cron. `subscription_authorized_payment` is the event name per Mercado
  // Pago's docs at the time this was written; matched loosely (substring)
  // rather than exact-string since this whole path is still unverified
  // against a real webhook payload — log webhook_events and re-check the
  // exact type/shape against the first real event received during testing.
  if (eventType.includes('authorized_payment') && paymentId) {
    try {
      await handleAuthorizedPayment(admin, String(paymentId));
    } catch (err) {
      await admin.from('webhook_events').insert({ provider: 'mercadopago', event_type: 'processing_error', payload: { authorizedPaymentId: paymentId, error: String(err) } });
    }
  }

  if (eventType === 'payment' && paymentId) {
    try {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
      });
      const payment = await res.json();
      const status = payment.status as string;

      // Match against whichever record we already stamped with this payment id.
      const { data: order } = await admin.from('orders').select('id, status').eq('mp_payment_id', String(paymentId)).maybeSingle();
      if (order) {
        const nextStatus = status === 'approved' ? 'em_andamento' : status === 'rejected' ? 'pagamento_recusado' : order.status;
        await admin.from('orders').update({ mp_status: status, status: nextStatus }).eq('id', order.id);
      }

      const { data: delivery } = await admin.from('subscription_deliveries').select('id').eq('mp_payment_id', String(paymentId)).maybeSingle();
      if (delivery && status === 'approved') {
        await admin.from('subscription_deliveries').update({ payment_status: 'paid', charged_at: new Date().toISOString() }).eq('id', delivery.id);
      }
    } catch (err) {
      await admin.from('webhook_events').insert({ provider: 'mercadopago', event_type: 'processing_error', payload: { paymentId, error: String(err) } });
    }
  }

  return NextResponse.json({ received: true });
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Resolves one Preapproval charge attempt: finds the subscription it
 * belongs to, finds "the current cycle" delivery (the one this attempt is
 * paying for — pending if this is the first attempt, or failed if Mercado
 * Pago already told us a prior attempt on this same cycle didn't go
 * through and is now retrying), and applies the outcome.
 *
 * A prior 'rejected' attempt is deliberately not treated as final here —
 * Mercado Pago's Preapproval retries a declined recurring charge
 * automatically on its own (the CHARGE_LEAD_DAYS buffer in
 * subscriptions/schedule.ts exists specifically to leave room for that
 * before the delivery date arrives), and each retry fires this same
 * handler again with a new authorized_payment id. Only 'processed' moves
 * the cycle forward (creates the next delivery / applies a pending pause,
 * cancel, or plan change); 'rejected' just flips the customer-facing
 * banner on. There's deliberately no code path yet that gives up on a
 * cycle for good the way the old cron's "skipped" outcome did — deciding
 * exactly when to stop waiting on Mercado Pago's own retries (still inside
 * the CHARGE_LEAD_DAYS buffer? at the delivery date itself?) is flagged as
 * an open question, not yet built.
 */
async function handleAuthorizedPayment(admin: AdminClient, authorizedPaymentId: string) {
  const detail = (await getAuthorizedPayment(authorizedPaymentId)) as {
    status?: string;
    preapproval_id?: string;
    payment?: { id?: string | number; status?: string };
  };

  const preapprovalId = detail.preapproval_id;
  if (!preapprovalId) return;

  const { data: subscription } = await admin.from('subscriptions').select('*').eq('mp_preapproval_id', preapprovalId).maybeSingle();
  if (!subscription) return;

  const { data: delivery } = await admin
    .from('subscription_deliveries')
    .select('*')
    .eq('subscription_id', subscription.id)
    .in('payment_status', ['pending', 'failed'])
    .order('sequence_index', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!delivery) return;

  const mpPaymentId = detail.payment?.id != null ? String(detail.payment.id) : authorizedPaymentId;

  if (detail.status === 'processed') {
    await admin
      .from('subscription_deliveries')
      .update({ payment_status: 'paid', charged_at: new Date().toISOString(), mp_payment_id: mpPaymentId })
      .eq('id', delivery.id);

    await admin.from('orders').insert({
      customer_id: subscription.customer_id,
      kind: 'assinatura',
      subscription_delivery_id: delivery.id,
      status: 'em_andamento',
      subtotal: subscription.price,
      total: subscription.price,
      address_id: subscription.address_id,
      delivery_date: delivery.delivery_date,
      payment_method: 'card',
      mp_payment_id: mpPaymentId,
      mp_status: detail.payment?.status ?? 'approved',
      message: delivery.message,
      recipient_name: delivery.recipient_name,
    });

    if (subscription.pending_action || subscription.pending_plan_change) {
      await applyPendingTransition(admin, subscription);
    } else if (subscription.status === 'ativa') {
      const { data: nextDate } = await admin.rpc('next_delivery_after', {
        prev_date: delivery.delivery_date,
        freq: subscription.freq,
        weekday_name: subscription.weekday,
      });
      await admin.rpc('build_delivery_schedule', {
        p_subscription_id: subscription.id,
        p_freq: subscription.freq,
        p_weekday: subscription.weekday,
        p_count: 1,
        p_message: subscription.message,
        p_recipient_name: subscription.recipient_name,
        p_first_delivery_date: nextDate as unknown as string,
      });
    }
    return;
  }

  if (detail.status === 'rejected' || detail.status === 'cancelled') {
    // Only flip the row if it isn't already 'failed' — avoids clobbering
    // anything else a concurrent retry-triggered event might be doing.
    if (delivery.payment_status !== 'failed') {
      await admin.from('subscription_deliveries').update({ payment_status: 'failed' }).eq('id', delivery.id);
    }
  }
}
