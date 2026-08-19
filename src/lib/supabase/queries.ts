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

/** A single product for /catalogo/[slug] — bouquets.id doubles as the slug. */
export async function getBouquetBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('bouquets').select('*').eq('id', slug).eq('active', true).maybeSingle();
  if (error) throw error;
  return data;
}

/** A specific, ordered set of bouquets by id — e.g. the 5 hand-picked for
 * the home page's "Buquês reais da Florê" grid. .in() doesn't preserve the
 * order of the ids passed in, so this re-sorts the result to match. */
export async function getBouquetsByIds(ids: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('bouquets').select('*').in('id', ids).eq('active', true);
  if (error) throw error;
  const byId = new Map(data.map((b) => [b.id, b]));
  return ids.map((id) => byId.get(id)).filter((b): b is NonNullable<typeof b> => Boolean(b));
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
