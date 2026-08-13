import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Service-role client — bypasses Row Level Security entirely.
 *
 * NEVER import this from a Client Component or expose it to the browser.
 * Use only in Route Handlers / Server Actions that have already verified
 * the caller is allowed to do what they're asking (admin session, cron
 * secret, webhook signature).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
