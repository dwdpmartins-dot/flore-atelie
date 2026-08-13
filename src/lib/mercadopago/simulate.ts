import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Admin-controlled "simular pagamento recusado" switch (Painel Admin >
 * Próximas cobranças confirmadas). When on, every checkout/assinatura
 * charge attempt short-circuits to declined *before* calling Mercado
 * Pago at all — lets the team demo the declined-payment modal without
 * needing a real test card that actually fails.
 */
export async function isSimulatingDecline(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await supabase.from('settings').select('value').eq('key', 'simulate_declined_payment').maybeSingle();
  return data?.value === true;
}
