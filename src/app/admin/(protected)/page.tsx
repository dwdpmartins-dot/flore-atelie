import { getAdminSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayISO } from '@/lib/delivery/holidays';
import AdminDashboard from '@/components/admin/AdminDashboard';

// Orders count toward revenue/KPIs once payment is actually confirmed —
// 'pendente' hasn't been charged yet, 'cancelado'/'pagamento_recusado'
// never will be (or had the money given back).
const REVENUE_STATUSES = ['em_andamento', 'entregue'] as const;

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  const admin = createAdminClient();

  const today = todayISO();
  const monthPrefix = today.slice(0, 7); // 'YYYY-MM'

  const [
    { data: aiSetting },
    { data: declineSetting },
    { data: shippingSetting },
    { data: inspiradoSetting },
    { data: plans },
    { data: flowers },
    { data: bouquets },
    { data: upcoming },
    { data: ordersForKpi },
    { count: activeSubscriptions },
    { data: recentOrders },
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
    // Lightweight: just enough columns to compute KPIs, not the full
    // order+items+address join used for the fulfillment list below —
    // this one has no limit, since a revenue total that silently excludes
    // older orders would be worse than useless.
    admin.from('orders').select('status, total, created_at'),
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'ativa'),
    admin
      .from('orders')
      .select('*, customers(name, phone), addresses(street, number, neighborhood, city), order_items(name_snapshot, qty)')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const revenueOrders = (ordersForKpi ?? []).filter((o) => (REVENUE_STATUSES as readonly string[]).includes(o.status));
  const totalRevenue = revenueOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const monthRevenue = revenueOrders.filter((o) => o.created_at.startsWith(monthPrefix)).reduce((sum, o) => sum + Number(o.total), 0);
  const orderCount = revenueOrders.length;
  const avgTicket = orderCount > 0 ? totalRevenue / orderCount : 0;

  return (
    <section style={{ maxWidth: 1080, margin: '0 auto', padding: '60px 28px 110px' }}>
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
        kpis={{ totalRevenue, monthRevenue, orderCount, avgTicket, activeSubscriptions: activeSubscriptions ?? 0 }}
        recentOrders={(recentOrders ?? []) as unknown as AdminOrder[]}
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

export interface AdminOrder {
  id: string;
  kind: 'avulso' | 'assinatura';
  status: 'pendente' | 'em_andamento' | 'entregue' | 'cancelado' | 'pagamento_recusado';
  total: number;
  delivery_date: string | null;
  delivery_period: 'manha' | 'tarde' | null;
  created_at: string;
  customers: { name: string | null; phone: string | null } | null;
  addresses: { street: string; number: string; neighborhood: string | null; city: string | null } | null;
  order_items: { name_snapshot: string; qty: number }[];
}
