import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** Public catalog reads shared by Server Components — all covered by the
 * "public read" RLS policies in 0003_rls.sql, so no auth is required. */

export async function getGalleryPhotos() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('gallery_photos').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

export async function getTestimonials() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function getBouquets(context: 'catalogo' | 'avulso_pronto') {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bouquets')
    .select('*')
    .eq('context', context)
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}

/**
 * The Catálogo page shows the 6 "catalogo" bouquets together with the 3
 * "avulso_pronto" ones (the same options offered in Buquê Avulso >
 * Prontos) — 9 total. Buquê Avulso's own Prontos tab keeps calling
 * getBouquets('avulso_pronto') on its own, unaffected. Fetched as two
 * queries and concatenated (catalogo first) rather than one .in(context)
 * query, so the order stays deliberate instead of interleaving wherever
 * the two sets happen to tie on sort_order.
 */
export async function getCatalogBouquets() {
  const [catalogo, avulsoProntos] = await Promise.all([getBouquets('catalogo'), getBouquets('avulso_pronto')]);
  return [...catalogo, ...avulsoProntos];
}

export async function getFlowers() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('flowers').select('*').eq('active', true).order('sort_order');
  if (error) throw error;
  return data;
}

export async function getSubscriptionPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('subscription_plans').select('*');
  if (error) throw error;
  return data;
}

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}
