import { adminLogin } from './actions';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 28px 110px' }}>
      <form
        action={adminLogin}
        style={{ maxWidth: 360, margin: '60px auto', display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}
      >
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontStyle: 'italic', color: '#4B5740', margin: '0 0 6px' }}>
          Acesso administrativo
        </h1>
        <input
          name="email"
          type="email"
          required
          placeholder="seu@email.com"
          style={{ padding: 14, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 14 }}
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Senha"
          style={{ padding: 14, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 14 }}
        />
        {error && <p style={{ fontSize: 12.5, color: '#C4836A', textAlign: 'center', margin: 0 }}>Usuário ou senha inválidos.</p>}
        <button
          type="submit"
          style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: 14, borderRadius: 2, fontSize: 14, cursor: 'pointer' }}
        >
          Entrar
        </button>
      </form>
    </section>
  );
}
