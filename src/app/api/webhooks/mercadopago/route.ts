import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

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
