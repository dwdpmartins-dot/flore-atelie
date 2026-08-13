import { Suspense } from 'react';
import { getCurrentCustomer } from '@/lib/auth/session';
import AuthGate from '@/components/auth/AuthGate';
import SignOutButton from '@/components/auth/SignOutButton';

export default async function MinhaContaPage() {
  const session = await getCurrentCustomer();

  if (!session) {
    return (
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 28px 110px' }}>
        <Suspense>
          <AuthGate />
        </Suspense>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 28px 110px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontStyle: 'italic', color: '#4B5740', margin: 0 }}>
          Minha Conta
        </h1>
        <SignOutButton />
      </div>
      {/* Dados / Pedidos / Assinatura / Endereços / Cartões tabs land here — Task 6. */}
      <p style={{ color: '#7C7F6D', fontSize: 14 }}>
        Olá, {session.customer?.name || session.email}. As abas de Dados, Pedidos, Assinatura, Endereços e Cartões
        estão sendo portadas a seguir.
      </p>
    </section>
  );
}
