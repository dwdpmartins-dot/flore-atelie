import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{ background: '#3A3F32', color: '#D8DBC9', padding: '70px 28px 30px' }}>
      <div className="footer-grid" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Image src="/assets/logo-flore.png" alt="Florê" width={34} height={34} style={{ objectFit: 'contain' }} />
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: '#FAF7F2' }}>Florê Ateliê</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: '#A7AB97', maxWidth: 280 }}>
            Boutique floral artesanal. Composições autorais para quem entende que flor certa muda o dia de alguém.
          </p>
        </div>
        <div>
          <h4 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8FA080', margin: '0 0 16px' }}>Navegue</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/catalogo" style={{ fontSize: 13, color: '#D8DBC9' }}>Catálogo</Link>
            <Link href="/assinatura" style={{ fontSize: 13, color: '#D8DBC9' }}>Assinatura</Link>
            <Link href="/monte-seu-buque" style={{ fontSize: 13, color: '#D8DBC9' }}>Monte seu Buquê</Link>
            <Link href="/minha-conta" style={{ fontSize: 13, color: '#D8DBC9' }}>Minha Conta</Link>
          </div>
        </div>
        <div>
          <h4 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8FA080', margin: '0 0 16px' }}>Contato</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href="https://www.instagram.com/floreatelie.floral" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#D8DBC9' }}>
              Instagram
            </a>
            <a
              href="https://wa.me/5511942364723?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20Flor%C3%AA%20Ateli%C3%AA%20e%20gostaria%20de%20saber%20mais."
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 13, color: '#D8DBC9' }}
            >
              WhatsApp
            </a>
            <a href="https://www.tiktok.com/@flore.ateliee" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#D8DBC9' }}>
              TikTok
            </a>
            <span style={{ fontSize: 13, color: '#D8DBC9' }}>contato@floreatelie.com.br</span>
          </div>
        </div>
        <div>
          <h4 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8FA080', margin: '0 0 16px' }}>Legal</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/politica-de-privacidade" style={{ fontSize: 13, color: '#D8DBC9' }}>Política de Privacidade</Link>
            <Link href="/termos-de-uso" style={{ fontSize: 13, color: '#D8DBC9' }}>Termos de Uso</Link>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1180, margin: '46px auto 0', paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: '#7C806C' }}>
        © 2026 Florê Ateliê — Idealizado por Evelyn Martins. Todos os direitos reservados.
      </div>
    </footer>
  );
}
