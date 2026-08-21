import { getAdminSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayISO } from '@/lib/delivery/holidays';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  const admin = createAdminClient();

  const today = todayISO();

  const [
    { data: aiSetting },
    { data: declineSetting },
    { data: shippingSetting },
    { data: inspiradoSetting },
    { data: plans },
    { data: flowers },
    { data: bouquets },
    { data: upcoming },
  ] = await Promise.all([
    admin.from('settings').select('value').eq('key', 'ai_illustration_enabled').maybeSingle(),
    admin.from('settings').select('value').eq('key', 'simulate_declined_payment').maybeSingle(),
    admin.from('settings').select('value').eq('key', 'shipping_formula').maybeSingle(),
    admin.from('settings').select('value').eq('key', 'inspirado_default_prices').maybeSingle(),
    admin.from('subscription_plans').select('*'),
    admin.from('flowers').select('*').order('sort_order'),
    admin.from('bouquets').select('*').eq('context', 'catalogo').order('sort_order'),
    admin
      .from('subscription_deliveries')
      .select('id, delivery_date, cutoff_date, payment_status, subscriptions(freq, size, customer_id, customers(name))')
      .lte('cutoff_date', today)
      .order('cutoff_date', { ascending: false })
      .limit(20),
  ]);

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '60px 28px 110px' }}>
      <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#C4836A' }}>Painel Admin</span>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, fontStyle: 'italic', color: '#4B5740', margin: '8px 0 8px' }}>
        Gestão da Florê
      </h1>
      <p style={{ fontSize: 12, color: '#A7AB97', margin: '0 0 40px' }}>{session?.email}</p>

      <AdminDashboard
        aiEnabled={aiSetting?.value === true}
        simulateDecline={declineSetting?.value === true}
        shipping={(shippingSetting?.value as { base: number; free_km: number; per_km: number }) ?? { base: 30, free_km: 3, per_km: 4 }}
        inspiradoPrices={(inspiradoSetting?.value as { P: number; M: number; G: number }) ?? { P: 99, M: 139, G: 189 }}
        plans={plans ?? []}
        flowers={flowers ?? []}
        bouquets={bouquets ?? []}
        upcomingCharges={(upcoming ?? []) as unknown as UpcomingCharge[]}
      />
    </section>
  );
}

export interface UpcomingCharge {
  id: string;
  delivery_date: string;
  cutoff_date: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'skipped';
  subscriptions: { freq: string; size: string; customers: { name: string | null } | null } | null;
}
