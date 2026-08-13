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
