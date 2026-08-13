import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Freq, Weekday } from '@/lib/supabase/types';

type Client = SupabaseClient<Database>;

/**
 * The earliest legal first-delivery date for a given weekday: the next
 * occurrence of that weekday whose 3-business-day cutoff hasn't already
 * passed today. Used for brand-new subscriptions and for resuming a
 * paused one (both need a "first delivery" that isn't already too late
 * to prep for).
 */
export async function computeFirstDeliveryDate(supabase: Client, freq: Freq, weekday: Weekday): Promise<string> {
  const { data: today } = await supabase.rpc('next_weekday_on_or_after', { d: new Date().toISOString().slice(0, 10), weekday_name: weekday });
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
