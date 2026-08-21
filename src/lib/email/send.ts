import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from './resend';
import {
  welcomeEmail,
  orderConfirmationEmail,
  subscriptionConfirmationEmail,
  paymentDeclinedEmail,
  subscriptionStatusEmail,
  deliveryReminderEmail,
  adminNewOrderEmail,
} from './templates';

type AdminClient = ReturnType<typeof createAdminClient>;

const ADMIN_INBOX = 'contato@floreatelie.com.br';

const EMPTY_ADDRESS = { street: '—', number: '', complement: null, neighborhood: null, city: null, state: null };

/**
 * Every function below takes its own admin (service-role) client rather
 * than a caller-scoped one — sending an email is a system-level side
 * effect, not something that should ever be blocked by the RLS policy of
 * whichever request happened to trigger it (a webhook, a cron, a customer
 * action all call these the same way).
 *
 * All of them are best-effort: sendEmail() itself never throws (see
 * resend.ts), and every DB read/write here is wrapped loosely enough that
 * a failure to send never surfaces to the caller — the business event that
 * triggered the email (an order got paid, a subscription confirmed) has
 * already happened and must not be rolled back or reported as failed just
 * because a notification didn't go out.
 */

// ───────────────────────── 1. Boas-vindas ─────────────────────────

/** Idempotent via customers.welcome_email_sent_at — safe to call from both
 * the email/password signup path and the OAuth callback without risking a
 * double-send for the same person. */
export async function sendWelcomeEmail(admin: AdminClient, customerId: string) {
  const { data: customer } = await admin
    .from('customers')
    .select('name, email, welcome_email_sent_at')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer || !customer.email || customer.welcome_email_sent_at) return;

  const payload = welcomeEmail({ name: customer.name || '' });
  const result = await sendEmail({ to: customer.email, subject: payload.subject, html: payload.html });
  if (result) {
    await admin.from('customers').update({ welcome_email_sent_at: new Date().toISOString() }).eq('id', customerId);
  }
}

// ───────────────────── shared order lookup ─────────────────────

async function loadOrderContext(admin: AdminClient, orderId: string) {
  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return null;

  const [{ data: items }, { data: address }, { data: customer }] = await Promise.all([
    admin.from('order_items').select('*').eq('order_id', orderId),
    admin.from('addresses').select('*').eq('id', order.address_id ?? '').maybeSingle(),
    admin.from('customers').select('*').eq('id', order.customer_id).maybeSingle(),
  ]);

  return { order, items: items ?? [], address, customer };
}

// ───────────────── 2. Pedido avulso confirmado ─────────────────

/** Idempotent via orders.status_email_sent_for -- only sends once per
 * distinct status the order reaches (so a webhook redelivery for the same
 * "approved" event doesn't resend, but a later different transition
 * still gets its own email). Safe to call from both the synchronous
 * checkout success path and the async webhook. */
export async function sendOrderConfirmationEmail(admin: AdminClient, orderId: string) {
  const ctx = await loadOrderContext(admin, orderId);
  if (!ctx) return;
  const { order, items, address, customer } = ctx;
  const email = customer?.email;
  const deliveryDate = order.delivery_date;
  if (!email || !deliveryDate || order.status_email_sent_for === 'em_andamento') return;

  const payload = orderConfirmationEmail({
    orderId: order.id,
    items: items.map((i) => ({ name: i.name_snapshot, qty: i.qty, unitPrice: i.unit_price })),
    subtotal: order.subtotal,
    shippingFee: order.shipping_fee,
    total: order.total,
    deliveryDate,
    deliveryPeriod: order.delivery_period as 'manha' | 'tarde' | null,
    address: address ?? EMPTY_ADDRESS,
  });
  const result = await sendEmail({ to: email, subject: payload.subject, html: payload.html });
  if (result) {
    await admin.from('orders').update({ status_email_sent_for: 'em_andamento' }).eq('id', orderId);
  }
}

// ───────────────────── 4. Pagamento recusado ─────────────────────

/** Order-backed variant (avulso) — idempotent via the same
 * status_email_sent_for column as the confirmation email above. */
export async function sendOrderDeclinedEmail(admin: AdminClient, orderId: string) {
  const { data: order } = await admin.from('orders').select('id, kind, customer_id, status_email_sent_for').eq('id', orderId).maybeSingle();
  if (!order || order.status_email_sent_for === 'pagamento_recusado') return;
  const { data: customer } = await admin.from('customers').select('email').eq('id', order.customer_id).maybeSingle();
  if (!customer?.email) return;

  const payload = paymentDeclinedEmail({ kind: order.kind as 'avulso' | 'assinatura' });
  const result = await sendEmail({ to: customer.email, subject: payload.subject, html: payload.html });
  if (result) {
    await admin.from('orders').update({ status_email_sent_for: 'pagamento_recusado' }).eq('id', orderId);
  }
}

/** No-order variant — a rejected Preapproval charge attempt never creates
 * an order row (see webhooks/mercadopago/route.ts), so there's nothing to
 * hang status_email_sent_for off of. The caller is responsible for its own
 * idempotency here (handleAuthorizedPayment only calls this the first time
 * a cycle flips to 'failed', not on every automatic MP retry). */
export async function sendDirectDeclinedEmail(admin: AdminClient, opts: { customerId: string; kind: 'avulso' | 'assinatura' }) {
  const { data: customer } = await admin.from('customers').select('email').eq('id', opts.customerId).maybeSingle();
  if (!customer?.email) return;
  const payload = paymentDeclinedEmail({ kind: opts.kind });
  await sendEmail({ to: customer.email, subject: payload.subject, html: payload.html });
}

// ───────────── 3. Assinatura confirmada (primeira cobrança) ─────────────

/** No DB guard needed -- the caller only ever calls this once a
 * subscription's first delivery is marked paid, and a delivery can only
 * make that transition once. */
export async function sendSubscriptionConfirmationEmail(
  admin: AdminClient,
  opts: { customerId: string; freq: string; size: string; price: number; nextDeliveryDate: string }
) {
  const { data: customer } = await admin.from('customers').select('email').eq('id', opts.customerId).maybeSingle();
  if (!customer?.email) return;
  const payload = subscriptionConfirmationEmail({ freq: opts.freq, size: opts.size, price: opts.price, nextDeliveryDate: opts.nextDeliveryDate });
  await sendEmail({ to: customer.email, subject: payload.subject, html: payload.html });
}

// ───────────────── 5. Assinatura pausada / cancelada ─────────────────

/** No DB guard needed -- called directly from the pause/cancel action
 * itself, once per button click. */
export async function sendSubscriptionStatusEmail(
  admin: AdminClient,
  opts: { customerId: string; action: 'pausada' | 'cancelada'; effectiveDate: string | null }
) {
  const { data: customer } = await admin.from('customers').select('email').eq('id', opts.customerId).maybeSingle();
  if (!customer?.email) return;
  const payload = subscriptionStatusEmail({ action: opts.action, effectiveDate: opts.effectiveDate });
  await sendEmail({ to: customer.email, subject: payload.subject, html: payload.html });
}

// ───────────────────── 6. Lembrete de entrega ─────────────────────

/** Idempotent via orders.reminder_email_sent_at. */
export async function sendOrderDeliveryReminder(admin: AdminClient, orderId: string) {
  const { data: order } = await admin.from('orders').select('id, customer_id, delivery_date, reminder_email_sent_at').eq('id', orderId).maybeSingle();
  if (!order || order.reminder_email_sent_at || !order.delivery_date) return;
  const { data: customer } = await admin.from('customers').select('email').eq('id', order.customer_id).maybeSingle();
  if (!customer?.email) return;

  const payload = deliveryReminderEmail({ deliveryDate: order.delivery_date, description: 'Seu pedido da Florê Ateliê chega' });
  const result = await sendEmail({ to: customer.email, subject: payload.subject, html: payload.html });
  if (result) {
    await admin.from('orders').update({ reminder_email_sent_at: new Date().toISOString() }).eq('id', orderId);
  }
}

/** Idempotent via subscription_deliveries.reminder_email_sent_at. */
export async function sendSubscriptionDeliveryReminder(admin: AdminClient, deliveryId: string) {
  const { data: delivery } = await admin
    .from('subscription_deliveries')
    .select('id, subscription_id, delivery_date, reminder_email_sent_at')
    .eq('id', deliveryId)
    .maybeSingle();
  if (!delivery || delivery.reminder_email_sent_at) return;

  const { data: subscription } = await admin.from('subscriptions').select('customer_id, freq, size').eq('id', delivery.subscription_id).maybeSingle();
  if (!subscription) return;
  const { data: customer } = await admin.from('customers').select('email').eq('id', subscription.customer_id).maybeSingle();
  if (!customer?.email) return;

  const payload = deliveryReminderEmail({
    deliveryDate: delivery.delivery_date,
    description: `Sua entrega da assinatura ${subscription.freq} ${subscription.size} chega`,
  });
  const result = await sendEmail({ to: customer.email, subject: payload.subject, html: payload.html });
  if (result) {
    await admin.from('subscription_deliveries').update({ reminder_email_sent_at: new Date().toISOString() }).eq('id', deliveryId);
  }
}

// ───────────────── 7. Notificação interna (admin) ─────────────────

/** Idempotent via orders.admin_notified_at. Fires for every paid order —
 * avulso or a subscription cycle — since the ateliê needs to know about
 * each one to prepare/deliver it, not just the first cycle of a
 * subscription (unlike sendSubscriptionConfirmationEmail, which is
 * customer-facing and only makes sense once). */
export async function sendAdminNewOrderNotification(admin: AdminClient, orderId: string) {
  const ctx = await loadOrderContext(admin, orderId);
  if (!ctx) return;
  const { order, items, address, customer } = ctx;
  if (order.admin_notified_at) return;

  const payload = adminNewOrderEmail({
    orderId: order.id,
    kind: order.kind as 'avulso' | 'assinatura',
    customerName: customer?.name || customer?.email || 'Cliente',
    customerPhone: customer?.phone || '',
    items: items.map((i) => ({ name: i.name_snapshot, qty: i.qty, unitPrice: i.unit_price })),
    address: address ?? EMPTY_ADDRESS,
    deliveryDate: order.delivery_date,
    total: order.total,
  });
  const result = await sendEmail({ to: ADMIN_INBOX, subject: payload.subject, html: payload.html });
  if (result) {
    await admin.from('orders').update({ admin_notified_at: new Date().toISOString() }).eq('id', orderId);
  }
}
