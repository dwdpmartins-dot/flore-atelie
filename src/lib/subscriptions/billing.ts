import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { chargeSavedCard } from '@/lib/mercadopago/server';
import { computeFirstDeliveryDate } from './schedule';
import type { Database } from '@/lib/supabase/types';

type AdminClient = ReturnType<typeof createAdminClient>;
type Delivery = Database['public']['Tables']['subscription_deliveries']['Row'];
type Subscription = Database['public']['Tables']['subscriptions']['Row'];

const FUTURE_CYCLES_TOPUP = 3;
const FUTURE_CYCLES_GENERATED = 6;

/**
 * After a delivery is resolved (paid or given up on), applies whatever the
 * subscription was waiting to do once its currently-locked cycle cleared —
 * see pauseSubscription/cancelSubscription/changeSubscriptionPlan in
 * assinatura/actions.ts, which prune every OTHER pending delivery when they
 * set pending_action/pending_plan_change, so this resolved delivery is
 * always the last one standing.
 *
 * Exported so the Mercado Pago webhook can call this too — under the
 * Preapproval model it's the webhook, not this cron, that learns a cycle
 * resolved.
 */
export async function applyPendingTransition(admin: AdminClient, subscription: Subscription) {
  if (subscription.pending_action) {
    const { type, effective_date } = subscription.pending_action;
    if (type === 'pause') {
      await admin.from('subscriptions').update({ status: 'pausada', paused_since: effective_date, pending_action: null }).eq('id', subscription.id);
    } else {
      await admin.from('subscriptions').update({ status: 'cancelada', pending_action: null }).eq('id', subscription.id);
    }
    return;
  }

  if (subscription.pending_plan_change) {
    const { freq, size } = subscription.pending_plan_change;
    const { data: plan } = await admin.from('subscription_plans').select('price').eq('freq', freq).eq('size', size).maybeSingle();
    await admin
      .from('subscriptions')
      .update({ freq, size, price: plan?.price ?? subscription.price, pending_plan_change: null })
      .eq('id', subscription.id);

    const firstDeliveryDate = await computeFirstDeliveryDate(admin, freq, subscription.weekday);
    // Preapproval-backed subscriptions only ever have one delivery
    // generated ahead of time (see build_delivery_schedule calls in
    // assinatura/actions.ts and the webhook) — legacy subscriptions
    // without a Preapproval keep the old rolling 6-cycle schedule.
    await admin.rpc('build_delivery_schedule', {
      p_subscription_id: subscription.id,
      p_freq: freq,
      p_weekday: subscription.weekday,
      p_count: subscription.mp_preapproval_id ? 1 : FUTURE_CYCLES_GENERATED,
      p_message: subscription.message,
      p_recipient_name: subscription.recipient_name,
      p_first_delivery_date: firstDeliveryDate,
    });
  }
}

async function chargeDelivery(admin: AdminClient, delivery: Delivery, subscription: Subscription): Promise<'paid' | 'failed'> {
  if (!subscription.card_id) return 'failed';

  const { data: card } = await admin.from('saved_cards').select('*').eq('id', subscription.card_id).maybeSingle();
  const { data: customer } = await admin.from('customers').select('email').eq('id', subscription.customer_id).maybeSingle();

  if (!card) return 'failed';

  try {
    const payment = await chargeSavedCard({
      mpCustomerId: card.mp_customer_id,
      mpCardId: card.mp_card_id,
      amount: subscription.price,
      description: `Florê Ateliê — Assinatura ${subscription.freq} ${subscription.size} (ciclo ${delivery.sequence_index})`,
      externalReference: `sub-cycle-${delivery.id}`,
      payerEmail: customer?.email || '',
    });

    if (payment.status !== 'approved') return 'failed';

    await admin
      .from('subscription_deliveries')
      .update({ payment_status: 'paid', charged_at: new Date().toISOString(), mp_payment_id: String(payment.id) })
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
      mp_payment_id: String(payment.id),
      mp_status: payment.status,
      message: delivery.message,
      recipient_name: delivery.recipient_name,
    });

    return 'paid';
  } catch {
    return 'failed';
  }
}

export interface BillingRunResult {
  charged: number;
  failed: number;
  skipped: number;
  toppedUp: number;
}

/**
 * The full daily billing pass. Only ever touches subscriptions WITHOUT a
 * mp_preapproval_id — i.e. ones created before the Preapproval migration.
 * Preapproval-backed subscriptions charge themselves on Mercado Pago's own
 * schedule and are exclusively driven by the subscription_authorized_payment
 * webhook instead (see api/webhooks/mercadopago/route.ts); this cron never
 * charges them, marks their deliveries failed, or tops up their schedule.
 *
 * For the subscriptions this still applies to:
 * 1. Charge every delivery whose cutoff_date has arrived and is still
 *    pending.
 * 2. Retry every delivery that failed at cutoff and has now reached its
 *    delivery_date — succeed late, or give up and skip it for free.
 * 3. Apply any pending pause/cancel/plan-change once its locked cycle
 *    resolves (paid or skipped).
 * 4. Top up each active subscription's generated schedule so it never
 *    runs dry between customer visits.
 */
export async function runBillingPass(): Promise<BillingRunResult> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const result: BillingRunResult = { charged: 0, failed: 0, skipped: 0, toppedUp: 0 };

  const { data: dueDeliveries } = await admin
    .from('subscription_deliveries')
    .select('*, subscriptions!inner(*)')
    .lte('cutoff_date', today)
    .eq('payment_status', 'pending');

  for (const row of dueDeliveries ?? []) {
    const subscription = (row as unknown as { subscriptions: Subscription }).subscriptions;
    if (subscription.status !== 'ativa') continue; // paused/cancelled mid-cycle shouldn't happen, but don't charge if so.
    // Preapproval-backed subscriptions charge themselves on Mercado Pago's
    // own schedule — this cron must never touch their deliveries, or it'll
    // mark a cycle "failed" the moment cutoff_date passes even though
    // Preapproval hasn't charged (or even attempted) it yet. See the
    // subscription_authorized_payment handling in the webhook instead.
    if (subscription.mp_preapproval_id) continue;

    const outcome = await chargeDelivery(admin, row, subscription);
    if (outcome === 'paid') {
      result.charged++;
      await applyPendingTransition(admin, subscription);
    } else {
      result.failed++;
      await admin.from('subscription_deliveries').update({ payment_status: 'failed' }).eq('id', row.id);
    }
  }

  const { data: overdueFailed } = await admin
    .from('subscription_deliveries')
    .select('*, subscriptions!inner(*)')
    .lte('delivery_date', today)
    .eq('payment_status', 'failed');

  for (const row of overdueFailed ?? []) {
    const subscription = (row as unknown as { subscriptions: Subscription }).subscriptions;
    if (subscription.mp_preapproval_id) continue; // see note above.

    const outcome = await chargeDelivery(admin, row, subscription);
    if (outcome === 'paid') {
      result.charged++;
    } else {
      result.skipped++;
      await admin.from('subscription_deliveries').update({ payment_status: 'skipped' }).eq('id', row.id);
    }
    await applyPendingTransition(admin, subscription);
  }

  // Preapproval-backed subscriptions are excluded here too — their schedule
  // is topped up one cycle at a time, reactively, by the webhook whenever
  // Mercado Pago confirms a charge, not pre-generated in bulk by this cron.
  const { data: activeSubs } = await admin.from('subscriptions').select('*').eq('status', 'ativa').is('mp_preapproval_id', null);
  for (const sub of activeSubs ?? []) {
    const { count } = await admin
      .from('subscription_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('subscription_id', sub.id)
      .eq('payment_status', 'pending');
    if ((count ?? 0) < FUTURE_CYCLES_TOPUP) {
      await admin.rpc('build_delivery_schedule', {
        p_subscription_id: sub.id,
        p_freq: sub.freq,
        p_weekday: sub.weekday,
        p_count: FUTURE_CYCLES_GENERATED,
        p_message: sub.message,
        p_recipient_name: sub.recipient_name,
      });
      result.toppedUp++;
    }
  }

  return result;
}
