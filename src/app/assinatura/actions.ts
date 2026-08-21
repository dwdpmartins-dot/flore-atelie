'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { hasCompleteProfile } from '@/lib/auth/session';
import { chargeSavedCard } from '@/lib/mercadopago/server';
import { isSimulatingDecline } from '@/lib/mercadopago/simulate';
import { computeFirstDeliveryDate, getNextPendingDelivery, isCutoffPassed, clearPendingDeliveries, getPlanPrice } from '@/lib/subscriptions/schedule';
import { todayISO } from '@/lib/delivery/holidays';
import type { Freq, Size, Weekday } from '@/lib/supabase/types';

const FUTURE_CYCLES_GENERATED = 6;

export interface CreateSubscriptionInput {
  freq: Freq;
  size: Size;
  weekday: Weekday;
  message: string;
  addressId: string;
  cardId: string;
  recipientName?: string;
}

export async function createSubscription(input: CreateSubscriptionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { data: customer } = await supabase.from('customers').select('*').eq('id', user.id).maybeSingle();
  if (!hasCompleteProfile(customer)) {
    return { error: 'Confirme nome e WhatsApp em Minha Conta antes de assinar.' };
  }

  const price = await getPlanPrice(supabase, input.freq, input.size);
  if (price == null) return { error: 'Plano indisponível no momento.' };

  const { data: card } = await supabase.from('saved_cards').select('*').eq('id', input.cardId).eq('customer_id', user.id).maybeSingle();
  if (!card) return { error: 'Cartão inválido.' };

  const firstDeliveryDate = await computeFirstDeliveryDate(supabase, input.freq, input.weekday);

  if (await isSimulatingDecline(supabase)) {
    return { declined: true };
  }

  // Charge the first cycle before anything is created — an active
  // subscription must never exist without a successful payment behind it.
  let paymentId: string | undefined;
  try {
    const payment = await chargeSavedCard({
      mpCustomerId: card.mp_customer_id,
      mpCardId: card.mp_card_id,
      amount: price,
      description: `Florê Ateliê — Assinatura ${input.freq} ${input.size}`,
      externalReference: `sub-first-${user.id}-${Date.now()}`,
      payerEmail: customer?.email || user.email || '',
    });
    if (payment.status !== 'approved') {
      // Not an exception -- Mercado Pago responded fine, just with a
      // non-approved status. status_detail is where the actual reason
      // lives (e.g. cc_rejected_other_reason, cc_rejected_call_for_authorize),
      // and it was never logged here before, only swallowed into a generic
      // "declined" for the customer.
      console.log('createSubscription: payment not approved', {
        paymentId: payment.id,
        status: payment.status,
        statusDetail: payment.status_detail,
      });
      return { declined: true };
    }
    paymentId = String(payment.id);
  } catch {
    return { declined: true };
  }

  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .insert({
      customer_id: user.id,
      freq: input.freq,
      size: input.size,
      weekday: input.weekday,
      status: 'ativa',
      message: input.message,
      recipient_name: input.recipientName || null,
      address_id: input.addressId,
      card_id: input.cardId,
      price,
    })
    .select()
    .single();

  if (subError || !subscription) return { error: 'Não foi possível criar a assinatura.' };

  await supabase.rpc('build_delivery_schedule', {
    p_subscription_id: subscription.id,
    p_freq: input.freq,
    p_weekday: input.weekday,
    p_count: FUTURE_CYCLES_GENERATED,
    p_message: input.message,
    p_recipient_name: input.recipientName || null,
    p_first_delivery_date: firstDeliveryDate,
  });

  const firstDelivery = await getNextPendingDelivery(supabase, subscription.id);
  if (firstDelivery) {
    await supabase
      .from('subscription_deliveries')
      .update({ payment_status: 'paid', charged_at: new Date().toISOString(), mp_payment_id: paymentId })
      .eq('id', firstDelivery.id);

    await supabase.from('orders').insert({
      customer_id: user.id,
      kind: 'assinatura',
      subscription_delivery_id: firstDelivery.id,
      status: 'em_andamento',
      subtotal: price,
      total: price,
      address_id: input.addressId,
      delivery_date: firstDelivery.delivery_date,
      payment_method: 'card',
      mp_payment_id: paymentId,
      mp_status: 'approved',
      message: input.message,
      recipient_name: input.recipientName || null,
    });
  }

  revalidatePath('/minha-conta');
  revalidatePath('/assinatura');
  return { success: true, subscriptionId: subscription.id };
}

async function loadOwnedSubscription(subscriptionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' as const };

  const { data: subscription } = await supabase.from('subscriptions').select('*').eq('id', subscriptionId).eq('customer_id', user.id).maybeSingle();
  if (!subscription) return { error: 'Assinatura não encontrada.' as const };

  return { supabase, subscription };
}

export async function pauseSubscription(subscriptionId: string) {
  const ctx = await loadOwnedSubscription(subscriptionId);
  if ('error' in ctx) return ctx;
  const { supabase, subscription } = ctx;

  const nextDelivery = await getNextPendingDelivery(supabase, subscriptionId);
  const cutoffPassed = nextDelivery ? await isCutoffPassed(supabase, nextDelivery.cutoff_date) : false;

  if (!nextDelivery || !cutoffPassed) {
    await clearPendingDeliveries(supabase, subscriptionId);
    await supabase
      .from('subscriptions')
      .update({ status: 'pausada', paused_since: todayISO(), pending_action: null })
      .eq('id', subscriptionId);
    revalidatePath('/minha-conta');
    revalidatePath('/assinatura');
    return { success: true, immediate: true };
  }

  // This cycle is already locked in — pause takes effect starting the
  // following one, which the billing cron applies once it processes
  // pending_action after charging the locked cycle.
  await clearPendingDeliveries(supabase, subscriptionId, nextDelivery.id);
  const { data: effectiveDateRaw } = await supabase.rpc('next_delivery_after', {
    prev_date: nextDelivery.delivery_date,
    freq: subscription.freq,
    weekday_name: subscription.weekday,
  });
  const effectiveDate = effectiveDateRaw as string;
  await supabase
    .from('subscriptions')
    .update({ pending_action: { type: 'pause', effective_date: effectiveDate } })
    .eq('id', subscriptionId);

  revalidatePath('/minha-conta');
  revalidatePath('/assinatura');
  return { success: true, immediate: false, effectiveDate };
}

export async function resumeSubscription(subscriptionId: string) {
  const ctx = await loadOwnedSubscription(subscriptionId);
  if ('error' in ctx) return ctx;
  const { supabase, subscription } = ctx;
  if (subscription.status !== 'pausada') return { error: 'Assinatura não está pausada.' };

  const firstDeliveryDate = await computeFirstDeliveryDate(supabase, subscription.freq, subscription.weekday);

  await supabase.from('subscriptions').update({ status: 'ativa', paused_since: null, pending_action: null }).eq('id', subscriptionId);

  await supabase.rpc('build_delivery_schedule', {
    p_subscription_id: subscriptionId,
    p_freq: subscription.freq,
    p_weekday: subscription.weekday,
    p_count: FUTURE_CYCLES_GENERATED,
    p_message: subscription.message,
    p_recipient_name: subscription.recipient_name,
    p_first_delivery_date: firstDeliveryDate,
  });

  revalidatePath('/minha-conta');
  revalidatePath('/assinatura');
  return { success: true };
}

export async function cancelSubscription(subscriptionId: string) {
  const ctx = await loadOwnedSubscription(subscriptionId);
  if ('error' in ctx) return ctx;
  const { supabase, subscription } = ctx;

  const nextDelivery = await getNextPendingDelivery(supabase, subscriptionId);
  const cutoffPassed = nextDelivery ? await isCutoffPassed(supabase, nextDelivery.cutoff_date) : false;

  if (!nextDelivery || !cutoffPassed) {
    await clearPendingDeliveries(supabase, subscriptionId);
    await supabase.from('subscriptions').update({ status: 'cancelada', pending_action: null }).eq('id', subscriptionId);
    revalidatePath('/minha-conta');
    revalidatePath('/assinatura');
    return { success: true, immediate: true };
  }

  await clearPendingDeliveries(supabase, subscriptionId, nextDelivery.id);
  const { data: effectiveDateRaw } = await supabase.rpc('next_delivery_after', {
    prev_date: nextDelivery.delivery_date,
    freq: subscription.freq,
    weekday_name: subscription.weekday,
  });
  const effectiveDate = effectiveDateRaw as string;
  await supabase.from('subscriptions').update({ pending_action: { type: 'cancel', effective_date: effectiveDate } }).eq('id', subscriptionId);

  revalidatePath('/minha-conta');
  revalidatePath('/assinatura');
  return { success: true, immediate: false, effectiveDate };
}

export async function editSubscriptionMessage(subscriptionId: string, message: string) {
  const ctx = await loadOwnedSubscription(subscriptionId);
  if ('error' in ctx) return ctx;
  const { supabase } = ctx;

  const trimmed = message.slice(0, 180);
  await supabase.from('subscriptions').update({ message: trimmed }).eq('id', subscriptionId);

  const nextDelivery = await getNextPendingDelivery(supabase, subscriptionId);
  const cutoffPassed = nextDelivery ? await isCutoffPassed(supabase, nextDelivery.cutoff_date) : false;

  // Every pending delivery not yet locked in gets the new message. The
  // locked-in one (if any) keeps whatever message it already had.
  let query = supabase.from('subscription_deliveries').update({ message: trimmed }).eq('subscription_id', subscriptionId).eq('payment_status', 'pending');
  if (nextDelivery && cutoffPassed) query = query.neq('id', nextDelivery.id);
  await query;

  let effectiveDate: string | undefined;
  if (nextDelivery && cutoffPassed) {
    const subRow = await supabase.from('subscriptions').select('freq, weekday').eq('id', subscriptionId).single();
    const { data } = await supabase.rpc('next_delivery_after', {
      prev_date: nextDelivery.delivery_date,
      freq: subRow.data!.freq,
      weekday_name: subRow.data!.weekday,
    });
    effectiveDate = data as unknown as string;
  }

  revalidatePath('/minha-conta');
  revalidatePath('/assinatura');
  return { success: true, lockedThisCycle: cutoffPassed, effectiveDate };
}

export async function changeSubscriptionPlan(subscriptionId: string, newFreq: Freq, newSize: Size) {
  const ctx = await loadOwnedSubscription(subscriptionId);
  if ('error' in ctx) return ctx;
  const { supabase, subscription } = ctx;

  const price = await getPlanPrice(supabase, newFreq, newSize);
  if (price == null) return { error: 'Plano indisponível.' };

  const nextDelivery = await getNextPendingDelivery(supabase, subscriptionId);
  const cutoffPassed = nextDelivery ? await isCutoffPassed(supabase, nextDelivery.cutoff_date) : false;

  if (!nextDelivery || !cutoffPassed) {
    await clearPendingDeliveries(supabase, subscriptionId);
    await supabase.from('subscriptions').update({ freq: newFreq, size: newSize, price, pending_plan_change: null }).eq('id', subscriptionId);
    const firstDeliveryDate = await computeFirstDeliveryDate(supabase, newFreq, subscription.weekday);
    await supabase.rpc('build_delivery_schedule', {
      p_subscription_id: subscriptionId,
      p_freq: newFreq,
      p_weekday: subscription.weekday,
      p_count: FUTURE_CYCLES_GENERATED,
      p_message: subscription.message,
      p_recipient_name: subscription.recipient_name,
      p_first_delivery_date: firstDeliveryDate,
    });
    revalidatePath('/minha-conta');
    revalidatePath('/assinatura');
    return { success: true, immediate: true };
  }

  await clearPendingDeliveries(supabase, subscriptionId, nextDelivery.id);
  const { data: effectiveDateRaw } = await supabase.rpc('next_delivery_after', {
    prev_date: nextDelivery.delivery_date,
    freq: subscription.freq,
    weekday_name: subscription.weekday,
  });
  const effectiveDate = effectiveDateRaw as string;
  await supabase
    .from('subscriptions')
    .update({ pending_plan_change: { freq: newFreq, size: newSize, effective_date: effectiveDate } })
    .eq('id', subscriptionId);

  revalidatePath('/minha-conta');
  revalidatePath('/assinatura');
  return { success: true, immediate: false, effectiveDate };
}
