import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWelcomeEmail } from '@/lib/email/send';

// Landing point for Google OAuth (and password-recovery links). Exchanges
// the ?code for a session cookie, then sends the person where they were
// headed before authenticating.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Same reasoning as AuthGate's default: Home, not Minha Conta, unless the
  // caller explicitly asked for somewhere else.
  const redirectTo = searchParams.get('redirect') || '/';

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data.user) {
      // Awaited (not fire-and-forget): this whole request is one
      // serverless invocation, and nothing here keeps the process alive
      // past the response, so an un-awaited call risks getting cut off
      // before it sends. Idempotent (see sendWelcomeEmail), so this is a
      // safe no-op on every Google login after the first, and on
      // password-recovery links too.
      await sendWelcomeEmail(createAdminClient(), data.user.id);
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
