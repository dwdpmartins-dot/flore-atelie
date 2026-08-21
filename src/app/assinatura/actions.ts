'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasCompleteProfile } from '@/lib/auth/session';
import { createPreapproval, updatePreapprovalStatus, updatePreapprovalAmount } from '@/lib/mercadopago/server';
import { sendSubscriptionStatusEmail } from '@/lib/email/send';
import { isSimulatingDecline } from '@/lib/mercadopago/simulate';
import {
  computeFirstDeliveryDate,
  getNextPendingDelivery,
  isCutoffPassed,
  clearPendingDeliveries,
  getPlanPrice,
  firstChargeDateFor,
  freqStepDays,
} from '@/lib/subscriptions/schedule';
import { todayISO } from '@/lib/delivery/holidays';
import type { Freq, Size, Weekday } from '@/lib/supabase/types';

const FUTURE_CYCLES_GENERATED = 6;

export interface CreateSubscriptionInput {
  freq: Freq;
  size: Size;
  weekday: Weekday;
  message: string;
  addressId: string;
  recipientName?: string;
  /** Fresh, single-use token minted directly from the card just entered
   * (the Card Payment Brick's own token) — never a saved card re-
   * tokenized through /v1/card_tokens. See createPreapproval. */
  cardToken: string;
}

/**
 * Lets the wizard show the real first-delivery date as soon as the
 * customer picks a weekday, instead of only finding out after paying —
 * "próxima segunda" isn't always literally the next occurrence of that
 * weekday, since one too close to today (inside the prep cutoff) gets
 * pushed a full week out. Read-only, same computation createSubscription
 * itself uses right before creating the Preapproval.
 */
export async function previewFirstDeliveryDate(freq: Freq, weekday: Weekday) {
  const supabase = await createClient();
  const date = await computeFirstDeliveryDate(supabase, freq, weekday);
  return { date };
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

  const { data: address } = await supabase.from('addresses').select('id, state').eq('id', input.addressId).eq('customer_id', user.id).maybeSingle();
  if (!address) return { error: 'Endereço inválido.' };
  // Addresses can only be saved for served states (see addAddress), but this
  // guards any saved before that rule existed, or added by another path.
  if (address.state !== 'SP') return { error: 'Por enquanto entregamos apenas no estado de São Paulo (SP).' };

  const firstDeliveryDate = await computeFirstDeliveryDate(supabase, input.freq, input.weekday);
  const payerEmail = customer?.email || user.email || '';

  if (await isSimulatingDecline(supabase)) {
    return { declined: true };
  }

  // Mercado Pago's Preapproval owns the recurring schedule from here —
  // charges the card automatically every `frequencyDays` days, starting
  // at `startDate`. The first cycle's startDate is "today" whenever the
  // first delivery is close (so the customer gets an answer right away,
  // same as before); later cycles inherit the CHARGE_LEAD_DAYS buffer
  // naturally once this is running (see firstChargeDateFor).
  const [frequencyDays, startDate] = await Promise.all([freqStepDays(supabase, input.freq), Promise.resolve(firstChargeDateFor(firstDeliveryDate))]);

  let preapprovalId: string;
  try {
    const preapproval = await createPreapproval({
      payerEmail,
      cardTokenId: input.cardToken,
      amount: price,
      frequencyDays,
      reason: `Florê Ateliê — Assinatura ${input.freq} ${input.size}`,
      externalReference: `sub-${user.id}-${Date.now()}`,
      startDate,
    });
    preapprovalId = preapproval.id as string;
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
      mp_preapproval_id: preapprovalId,
      price,
    })
    .select()
    .single();

  if (subError || !subscription) return { error: 'Não foi possível criar a assinatura.' };

  // Only the first delivery is created here — unlike the old model, future
  // cycles aren't pre-generated up front. Each one is created reactively
  // by the webhook once Mercado Pago actually confirms that cycle's
  // charge, since we no longer control (or know in advance) exactly when
  // each Preapproval charge will land. This row starts "pending"; the
  // webhook flips it to paid/failed once Mercado Pago reports the outcome
  // of this first charge (which, per Preapproval's own semantics, isn't
  // guaranteed to be reflected synchronously in the createPreapproval
  // response above — see checkFirstChargeStatus, which the wizard polls).
  const { error: scheduleError } = await supabase.rpc('build_delivery_schedule', {
    p_subscription_id: subscription.id,
    p_freq: input.freq,
    p_weekday: input.weekday,
    p_count: 1,
    p_message: input.message,
    p_recipient_name: input.recipientName || null,
    p_first_delivery_date: firstDeliveryDate,
  });
  // Never silently swallowed again: this call previously errored on every
  // single subscription (a missing RLS policy blocked the insert), and
  // because the error went unchecked, the wizard fell back to a path that
  // showed "Assinatura confirmada!" anyway, with zero deliveries actually
  // scheduled. Logged loudly here so a regression is visible in Vercel
  // logs instead of only discoverable by manually querying the database.
  if (scheduleError) console.error('createSubscription: build_delivery_schedule failed', scheduleError);

  const firstDelivery = await getNextPendingDelivery(supabase, subscription.id);

  revalidatePath('/minha-conta');
  revalidatePath('/assinatura');
  return { success: true, subscriptionId: subscription.id, firstDeliveryId: firstDelivery?.id ?? null };
}

/**
 * Polled by the wizard right after createSubscription returns, since a
 * Preapproval's own creation response doesn't reliably confirm whether
 * its first charge was actually approved — that arrives separately (via
 * webhook, which flips subscription_deliveries.payment_status). Mirrors
 * checkPixStatus's polling shape in checkout/actions.ts.
 */
export async function checkFirstChargeStatus(deliveryId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'pending' as const };

  const { data: delivery } = await supabase
    .from('subscription_deliveries')
    .select('payment_status, subscriptions!inner(customer_id)')
    .eq('id', deliveryId)
    .maybeSingle();

  const owner = (delivery as unknown as { subscriptions: { customer_id: string } } | null)?.subscriptions?.customer_id;
  if (!delivery || owner !== user.id) return { status: 'pending' as const };

  if (delivery.payment_status === 'paid') return { status: 'paid' as const };
  if (delivery.payment_status === 'failed' || delivery.payment_status === 'skipped') return { status: 'failed' as const };
  return { status: 'pending' as const };
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
    // Pausing takes effect immediately — also tell Mercado Pago to stop
    // charging this Preapproval right away. Not fatal if this call fails
    // (network hiccup, etc.): our own status still flips, and the
    // customer-facing UI already reflects "pausada" either way; logged so
    // it isn't silently lost if MP genuinely keeps charging.
    if (subscription.mp_preapproval_id) {
      try {
        await updatePreapprovalStatus(subscription.mp_preapproval_id, 'paused');
      } catch (err) {
        console.error('pauseSubscription: failed to pause Preapproval on Mercado Pago', err);
      }
    }
    await clearPendingDeliveries(supabase, subscriptionId);
    await supabase
      .from('subscriptions')
      .update({ status: 'pausada', paused_since: todayISO(), pending_action: null })
      .eq('id', subscriptionId);
    await sendSubscriptionStatusEmail(createAdminClient(), { customerId: subscription.customer_id, action: 'pausada', effectiveDate: null });
    revalidatePath('/minha-conta');
    revalidatePath('/assinatura');
    return { success: true, immediate: true };
  }

  // This cycle is already locked in (its charge is scheduled to fire
  // inside the CHARGE_LEAD_DAYS window) — pause takes effect once that
  // charge resolves, applied by the webhook (see applyPendingTransition
  // equivalent there), not by a cron checking dates anymore.
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
  await sendSubscriptionStatusEmail(createAdminClient(), { customerId: subscription.customer_id, action: 'pausada', effectiveDate });

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

  if (subscription.mp_preapproval_id) {
    try {
      await updatePreapprovalStatus(subscription.mp_preapproval_id, 'authorized');
    } catch {
      return { error: 'Não foi possível retomar a cobrança no Mercado Pago. Tente novamente.' };
    }
  }

  await supabase.from('subscriptions').update({ status: 'ativa', paused_since: null, pending_action: null }).eq('id', subscriptionId);

  // Reactive model: only re-seed the next single delivery — the ones after
  // that get created as Mercado Pago confirms each cycle, same as
  // createSubscription. FUTURE_CYCLES_GENERATED only still applies to
  // subscriptions predating the Preapproval migration (no
  // mp_preapproval_id), so their old topped-up schedule keeps working.
  const { error: resumeScheduleError } = await supabase.rpc('build_delivery_schedule', {
    p_subscription_id: subscriptionId,
    p_freq: subscription.freq,
    p_weekday: subscription.weekday,
    p_count: subscription.mp_preapproval_id ? 1 : FUTURE_CYCLES_GENERATED,
    p_message: subscription.message,
    p_recipient_name: subscription.recipient_name,
    p_first_delivery_date: firstDeliveryDate,
  });
  if (resumeScheduleError) console.error('resumeSubscription: build_delivery_schedule failed', resumeScheduleError);

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
    // Cancelling a Preapproval on Mercado Pago is permanent (unlike pause,
    // it can't be reactivated) — matches "cancelada" being a terminal
    // status here too, so this is safe to fire immediately.
    if (subscription.mp_preapproval_id) {
      try {
        await updatePreapprovalStatus(subscription.mp_preapproval_id, 'cancelled');
      } catch (err) {
        console.error('cancelSubscription: failed to cancel Preapproval on Mercado Pago', err);
      }
    }
    await clearPendingDeliveries(supabase, subscriptionId);
    await supabase.from('subscriptions').update({ status: 'cancelada', pending_action: null }).eq('id', subscriptionId);
    await sendSubscriptionStatusEmail(createAdminClient(), { customerId: subscription.customer_id, action: 'cancelada', effectiveDate: null });
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
  await sendSubscriptionStatusEmail(createAdminClient(), { customerId: subscription.customer_id, action: 'cancelada', effectiveDate });

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

/**
 * Changes which saved address a subscription delivers to. Unlike message
 * or plan changes, this needs no cutoff-locking logic: subscription_
 * deliveries doesn't store its own address_id snapshot — the order
 * created for each cycle (see the webhook's handleAuthorizedPayment)
 * reads subscriptions.address_id at charge time, whatever it is then. So
 * updating it here takes effect starting with the very next charge,
 * automatically, even if a delivery is already "locked in" for cutoff
 * purposes on the message/plan side.
 */
export async function changeSubscriptionAddress(subscriptionId: string, addressId: string) {
  const ctx = await loadOwnedSubscription(subscriptionId);
  if ('error' in ctx) return ctx;
  const { supabase, subscription } = ctx;

  const { data: address } = await supabase.from('addresses').select('id, state').eq('id', addressId).eq('customer_id', subscription.customer_id).maybeSingle();
  if (!address) return { error: 'Endereço inválido.' };
  if (address.state !== 'SP') return { error: 'Por enquanto entregamos apenas no estado de São Paulo (SP).' };

  await supabase.from('subscriptions').update({ address_id: addressId }).eq('id', subscriptionId);

  revalidatePath('/minha-conta');
  revalidatePath('/assinatura');
  return { success: true };
}

export async function changeSubscriptionPlan(subscriptionId: string, newFreq: Freq, newSize: Size) {
  const ctx = await loadOwnedSubscription(subscriptionId);
  if ('error' in ctx) return ctx;
  const { supabase, subscription } = ctx;

  const price = await getPlanPrice(supabase, newFreq, newSize);
  if (price == null) return { error: 'Plano indisponível.' };

  // Mercado Pago's preapproval update endpoint (PUT /preapproval/{id}) only
  // accepts start_date/end_date/transaction_amount in auto_recurring -- not
  // frequency/frequency_type (confirmed against MP's own SDK type
  // definitions). So there's no way to move an existing Preapproval to a new
  // billing rhythm; only a brand new Preapproval (with a freshly entered
  // card) could. Rather than let our own freq drift out of sync with what MP
  // actually charges on, block a frequency change here until a
  // cancel-and-recreate flow exists for it. A size-only change (same freq,
  // new price) is unaffected -- that's the case handled below.
  if (subscription.mp_preapproval_id && newFreq !== subscription.freq) {
    return { error: 'Para trocar a frequência da assinatura, é preciso cancelar a atual e assinar novamente no novo ritmo. O tamanho do buquê pode ser alterado a qualquer momento.' };
  }

  const nextDelivery = await getNextPendingDelivery(supabase, subscriptionId);
  const cutoffPassed = nextDelivery ? await isCutoffPassed(supabase, nextDelivery.cutoff_date) : false;

  if (!nextDelivery || !cutoffPassed) {
    if (subscription.mp_preapproval_id && price !== subscription.price) {
      try {
        await updatePreapprovalAmount(subscription.mp_preapproval_id, price);
      } catch {
        return { error: 'Não foi possível atualizar o valor no Mercado Pago. Tente novamente em instantes.' };
      }
    }
    await clearPendingDeliveries(supabase, subscriptionId);
    await supabase.from('subscriptions').update({ freq: newFreq, size: newSize, price, pending_plan_change: null }).eq('id', subscriptionId);
    const firstDeliveryDate = await computeFirstDeliveryDate(supabase, newFreq, subscription.weekday);

    const { error: planChangeScheduleError } = await supabase.rpc('build_delivery_schedule', {
      p_subscription_id: subscriptionId,
      p_freq: newFreq,
      p_weekday: subscription.weekday,
      p_count: subscription.mp_preapproval_id ? 1 : FUTURE_CYCLES_GENERATED,
      p_message: subscription.message,
      p_recipient_name: subscription.recipient_name,
      p_first_delivery_date: firstDeliveryDate,
    });
    if (planChangeScheduleError) console.error('changeSubscriptionPlan: build_delivery_schedule failed', planChangeScheduleError);
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
