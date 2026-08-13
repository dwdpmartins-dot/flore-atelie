import { NextResponse } from 'next/server';
import { runBillingPass } from '@/lib/subscriptions/billing';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Vercel Cron hits this once a day (see vercel.json) with an
// "Authorization: Bearer $CRON_SECRET" header it adds automatically when
// CRON_SECRET is set as a project env var. Reject anything else so this
// can't be triggered by a random request to bill people's cards.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const result = await runBillingPass();
  return NextResponse.json({ ok: true, ...result });
}
