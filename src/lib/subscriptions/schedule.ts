import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Freq, Weekday } from '@/lib/supabase/types';
import { todayISO } from '@/lib/delivery/holidays';

type Client = SupabaseClient<Database>;

/**
 * The earliest legal first-delivery date for a given weekday: the next
 * occurrence of that weekday whose 3-business-day cutoff hasn't already
 * passed today. Used for brand-new subscriptions and for resuming a
 * paused one (both need a "first delivery" that isn't already too late
 * to prep for).
 */
export async function computeFirstDeliveryDate(supabase: Client, freq: Freq, weekday: Weekday): Promise<string> {
  const { data: today } = await supabase.rpc('next_weekday_on_or_after', { d: todayISO(), weekday_name: weekday });
  let candidate = today as unknown as string;

  // Guard against an infinite loop from unexpected RPC failures.
  for (let i = 0; i < 10; i++) {
    const { data: cutoff } = await supabase.rpc('subtract_business_days', { d: candidate, n: 3 });
    const { data: passed } = await supabase.rpc('is_cutoff_passed', { p_cutoff_date: cutoff as unknown as string });
    if (!passed) return candidate;
    const { data: next } = await supabase.rpc('next_delivery_after', { prev_date: candidate, freq, weekday_name: weekday });
    candidate = next as unknown as string;
  }
  return candidate;
}

/** The next not-yet-charged delivery for a subscription (lowest sequence_index still pending). */
export async function getNextPendingDelivery(supabase: Client, subscriptionId: string) {
  const { data } = await supabase
    .from('subscription_deliveries')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .eq('payment_status', 'pending')
    .order('sequence_index', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function isCutoffPassed(supabase: Client, cutoffDate: string): Promise<boolean> {
  const { data } = await supabase.rpc('is_cutoff_passed', { p_cutoff_date: cutoffDate });
  return Boolean(data);
}

/** Deletes every still-pending (not yet charged) delivery for a subscription. */
export async function clearPendingDeliveries(supabase: Client, subscriptionId: string, exceptId?: string) {
  let query = supabase.from('subscription_deliveries').delete().eq('subscription_id', subscriptionId).eq('payment_status', 'pending');
  if (exceptId) query = query.neq('id', exceptId);
  await query;
}

export async function getPlanPrice(supabase: Client, freq: Freq, size: Database['public']['Tables']['subscription_plans']['Row']['size']) {
  const { data } = await supabase.from('subscription_plans').select('price').eq('freq', freq).eq('size', size).maybeSingle();
  return data?.price ?? null;
}

/**
 * Days before a delivery its Preapproval charge should be scheduled for.
 * Not the same thing as the 3-business-day "cutoff" used for the old
 * chargeSavedCard model -- this is a wider buffer specifically to leave
 * Mercado Pago's own automatic retry mechanism room to resolve a declined
 * card before the delivery date arrives (we no longer control retry
 * timing ourselves once a Preapproval is charging on its own schedule).
 */
export const CHARGE_LEAD_DAYS = 7;

/** When a Preapproval cycle paying for `deliveryDateISO` should be charged
 * — clamped to today if the buffer would land in the past (e.g. the first
 * delivery is coming up sooner than the usual lead time allows). */
export function firstChargeDateFor(deliveryDateISO: string): string {
  const d = new Date(`${deliveryDateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - CHARGE_LEAD_DAYS);
  const candidate = d.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return candidate < today ? today : candidate;
}

/** The recurring interval Mercado Pago should charge on, in days — same
 * mapping as the freq_step_days Postgres function (single source of
 * truth for "Semanal"/"Quinzenal"/"Mensal" -> 7/15/30), fetched via RPC
 * instead of duplicated here so the two never drift apart. */
export async function freqStepDays(supabase: Client, freq: Freq): Promise<number> {
  const { data } = await supabase.rpc('freq_step_days', { freq });
  return data as unknown as number;
}
