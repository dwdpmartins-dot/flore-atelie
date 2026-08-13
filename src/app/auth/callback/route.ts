import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Landing point for Google OAuth (and password-recovery links). Exchanges
// the ?code for a session cookie, then sends the person where they were
// headed before authenticating.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirect') || '/minha-conta';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
