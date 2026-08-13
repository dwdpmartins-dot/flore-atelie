'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function adminLogin(formData: FormData) {
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect('/admin/entrar?error=1');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: isAdmin } = await admin.from('admin_users').select('id').eq('id', user!.id).maybeSingle();

  if (!isAdmin) {
    // Real credentials, but not an admin: don't leave them signed in on the
    // public session and don't reveal that the account exists.
    await supabase.auth.signOut();
    redirect('/admin/entrar?error=1');
  }

  redirect('/admin');
}
