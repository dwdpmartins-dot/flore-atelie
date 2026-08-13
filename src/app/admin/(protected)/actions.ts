'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Freq, Size } from '@/lib/supabase/types';

async function adminClient() {
  await requireAdmin(); // throws/redirects if not an admin — every action re-checks, never trusts the caller.
  return createAdminClient();
}

export async function toggleAi() {
  const admin = await adminClient();
  const { data } = await admin.from('settings').select('value').eq('key', 'ai_illustration_enabled').maybeSingle();
  await admin.from('settings').upsert({ key: 'ai_illustration_enabled', value: !(data?.value === true) });
  revalidatePath('/admin');
}

export async function toggleSimulateDecline() {
  const admin = await adminClient();
  const { data } = await admin.from('settings').select('value').eq('key', 'simulate_declined_payment').maybeSingle();
  await admin.from('settings').upsert({ key: 'simulate_declined_payment', value: !(data?.value === true) });
  revalidatePath('/admin');
}

export async function updateShippingFormula(base: number, freeKm: number, perKm: number) {
  const admin = await adminClient();
  await admin.from('settings').upsert({ key: 'shipping_formula', value: { base, free_km: freeKm, per_km: perKm } });
  revalidatePath('/admin');
}

export async function updateInspiradoPrice(size: Size, value: number) {
  const admin = await adminClient();
  const { data } = await admin.from('settings').select('value').eq('key', 'inspirado_default_prices').maybeSingle();
  const current = (data?.value as Record<Size, number>) ?? { P: 99, M: 139, G: 189 };
  await admin.from('settings').upsert({ key: 'inspirado_default_prices', value: { ...current, [size]: value } });
  revalidatePath('/admin');
}

export async function updatePlanPrice(freq: Freq, size: Size, price: number) {
  const admin = await adminClient();
  await admin.from('subscription_plans').update({ price }).eq('freq', freq).eq('size', size);
  revalidatePath('/admin');
}

export async function updateFlowerPrice(id: string, price: number) {
  const admin = await adminClient();
  await admin.from('flowers').update({ price }).eq('id', id);
  revalidatePath('/admin');
}

export async function toggleFlowerActive(id: string) {
  const admin = await adminClient();
  const { data } = await admin.from('flowers').select('active').eq('id', id).maybeSingle();
  await admin.from('flowers').update({ active: !data?.active }).eq('id', id);
  revalidatePath('/admin');
}

export async function toggleBouquetActive(id: string) {
  const admin = await adminClient();
  const { data } = await admin.from('bouquets').select('active').eq('id', id).maybeSingle();
  await admin.from('bouquets').update({ active: !data?.active }).eq('id', id);
  revalidatePath('/admin');
}

/** Demo tool: force the nearest confirmed delivery into a failed payment state, to preview the customer-facing banner. */
export async function simulatePaymentFailure() {
  const admin = await adminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: delivery } = await admin
    .from('subscription_deliveries')
    .select('id')
    .lte('cutoff_date', today)
    .in('payment_status', ['pending', 'paid'])
    .order('sequence_index', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (delivery) {
    await admin.from('subscription_deliveries').update({ payment_status: 'failed' }).eq('id', delivery.id);
  }
  revalidatePath('/admin');
  revalidatePath('/minha-conta');
}

export async function clearPaymentFailure() {
  const admin = await adminClient();
  await admin.from('subscription_deliveries').update({ payment_status: 'pending' }).eq('payment_status', 'failed');
  revalidatePath('/admin');
  revalidatePath('/minha-conta');
}
