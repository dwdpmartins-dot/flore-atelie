import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayISO } from '@/lib/delivery/holidays';
import { sendOrderDeliveryReminder, sendSubscriptionDeliveryReminder } from '@/lib/email/send';

export const runtime = 'nodejs';
export const maxDuration = 60;

function tomorrowISO(): string {
  const d = new Date(`${todayISO()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Vercel Cron hits this once a day (see vercel.json), same
// Authorization/CRON_SECRET pattern as subscription-billing. Reminds
// customers about anything delivering tomorrow -- an avulso order already
// paid, or a subscription cycle already charged. Idempotent per row (see
// send.ts), so a re-run the same day is a safe no-op.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const tomorrow = tomorrowISO();
  let orders = 0;
  let deliveries = 0;

  const { data: dueOrders } = await admin
    .from('orders')
    .select('id')
    .eq('kind', 'avulso')
    .eq('status', 'em_andamento')
    .eq('delivery_date', tomorrow)
    .is('reminder_email_sent_at', null);
  for (const o of dueOrders ?? []) {
    await sendOrderDeliveryReminder(admin, o.id);
    orders++;
  }

  const { data: dueDeliveries } = await admin
    .from('subscription_deliveries')
    .select('id')
    .eq('payment_status', 'paid')
    .eq('delivery_date', tomorrow)
    .is('reminder_email_sent_at', null);
  for (const d of dueDeliveries ?? []) {
    await sendSubscriptionDeliveryReminder(admin, d.id);
    deliveries++;
  }

  return NextResponse.json({ ok: true, tomorrow, orders, deliveries });
}
