import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';

type Customer = Database['public']['Tables']['customers']['Row'];

/** Signed-in user + their customer profile row, or null if logged out. */
export async function getCurrentCustomer(): Promise<{ userId: string; email: string | null; customer: Customer | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: customer } = await supabase.from('customers').select('*').eq('id', user.id).maybeSingle();
  return { userId: user.id, email: user.email ?? null, customer: customer ?? null };
}

/**
 * Use in Server Components for pages that require a signed-in customer
 * (checkout, assinatura, minha-conta tabs). Redirects to the account/login
 * screen with a return URL, matching the "sessão expirada" flow.
 */
export async function requireCustomer(currentPath: string) {
  const session = await getCurrentCustomer();
  if (!session) {
    redirect(`/minha-conta?redirect=${encodeURIComponent(currentPath)}`);
  }
  return session;
}

/**
 * True when name + phone are both filled in — the gate the prototype used
 * before allowing checkout/assinatura ("cadastro completo").
 */
export function hasCompleteProfile(customer: Customer | null): boolean {
  return Boolean(customer?.name?.trim() && customer?.phone?.trim());
}

/** Admin session check: signed in AND present in admin_users. */
export async function getAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // admin_users has no RLS policies granting anon/authenticated access, so
  // this lookup must go through the service-role client.
  const admin = createAdminClient();
  const { data } = await admin.from('admin_users').select('id').eq('id', user.id).maybeSingle();
  if (!data) return null;

  return { userId: user.id, email: user.email ?? null };
}

/** Use at the top of every /admin/* Server Component (except /admin/entrar). */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) {
    redirect('/admin/entrar');
  }
  return session;
}
