'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWelcomeEmail } from '@/lib/email/send';

/**
 * Fires the welcome email for whoever the current session belongs to.
 * Idempotent (see sendWelcomeEmail's welcome_email_sent_at guard), so this
 * is safe to call from AuthGate right after a successful email/password
 * signup even though the exact same customer could also land here again
 * later via Google login.
 */
export async function sendWelcomeEmailForCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await sendWelcomeEmail(createAdminClient(), user.id);
}
