import Link from 'next/link';

export default function NotFound() {
  return (
    <section style={{ maxWidth: 520, margin: '0 auto', padding: '110px 28px 130px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#C4836A' }}>Página não encontrada</span>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,40px)', fontStyle: 'italic', color: '#4B5740', margin: 0 }}>
        Essa flor não está no nosso jardim.
      </h1>
      <p style={{ fontSize: 14.5, color: '#7C7F6D', lineHeight: 1.7, maxWidth: 380 }}>
        O endereço que você tentou acessar não existe ou foi movido. Que tal voltar para a home e escolher seu
        jeito de florir?
      </p>
      <Link href="/" style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '14px 28px', borderRadius: 2, fontSize: 14 }}>
        Voltar à home
      </Link>
    </section>
  );
}
