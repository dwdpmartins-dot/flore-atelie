import { getAdminSession } from '@/lib/auth/session';

export default async function AdminDashboardPage() {
  const session = await getAdminSession();

  return (
    <section style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 28px 110px' }}>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontStyle: 'italic', color: '#4B5740', margin: '0 0 24px' }}>
        Painel administrativo
      </h1>
      <p style={{ color: '#7C7F6D', fontSize: 14 }}>
        Sessão de {session?.email}. Preços de flores, buquês, planos de assinatura, formula de frete, IA e pedidos
        chegam aqui — Task 11.
      </p>
    </section>
  );
}
