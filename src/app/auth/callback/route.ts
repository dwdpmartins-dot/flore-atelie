import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Landing point for password-recovery links. Exchanges the ?code for a
// session cookie, then sends the person where they were headed --
// redefinir-senha, per resetPasswordForEmail's own redirectTo in
// AuthGate.tsx.
//
// Google OAuth used to redirect through here too, but doesn't anymore: it
// now signs in via Google Identity Services directly on the page (see
// lib/auth/googleIdentity.ts and AuthGate.tsx), specifically to avoid
// bouncing through this route's domain, which is what Google's own
// consent screen showed to the customer instead of "Florê Ateliê".
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Same reasoning as AuthGate's default: Home, not Minha Conta, unless the
  // caller explicitly asked for somewhere else.
  const redirectTo = searchParams.get('redirect') || '/';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
