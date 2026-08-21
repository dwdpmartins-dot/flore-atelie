import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPreapproval, logMpError } from '@/lib/mercadopago/server';

export const runtime = 'nodejs';

/**
 * TEMPORARY diagnostic route — not linked from any UI. Queries Mercado
 * Pago directly for the most recent subscription's Preapproval object,
 * to settle "was the money actually charged?" with ground truth instead
 * of guessing from which of Mercado Pago's own dashboard screens does or
 * doesn't happen to surface a plan-less Preapproval. Admin-gated (same
 * check every other admin action uses). Safe to delete once the current
 * investigation is done.
 */
export async function GET() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, mp_preapproval_id, status, price, created_at')
    .not('mp_preapproval_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.mp_preapproval_id) {
    return NextResponse.json({ error: 'Nenhuma assinatura com mp_preapproval_id encontrada no banco.' });
  }

  const { data: deliveries } = await admin
    .from('subscription_deliveries')
    .select('sequence_index, delivery_date, payment_status, charged_at, mp_payment_id')
    .eq('subscription_id', sub.id)
    .order('sequence_index', { ascending: true });

  try {
    const preapproval = await getPreapproval(sub.mp_preapproval_id);
    return NextResponse.json({ ourSubscription: sub, ourDeliveries: deliveries, mercadoPagoPreapproval: preapproval });
  } catch (err) {
    logMpError('debug-preapproval: getPreapproval failed', err);
    return NextResponse.json({ ourSubscription: sub, ourDeliveries: deliveries, error: 'getPreapproval falhou — veja os logs.' });
  }
}
