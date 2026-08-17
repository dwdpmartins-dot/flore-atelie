import Image from 'next/image';
import Link from 'next/link';
import { getGalleryPhotos, getTestimonials } from '@/lib/supabase/queries';
import GalleryLightbox from '@/components/home/GalleryLightbox';

const categoryPreviews = [
  { href: '/assinatura', src: '/assets/flore-arranjo-1.png', title: 'Assinatura', desc: 'Flores novas na sua casa, em ciclos que você escolhe.', cta: 'Assinar' },
  { href: '/buque-avulso', src: '/assets/flore-arranjo-5.png', title: 'Buquê Avulso', desc: 'Monte do zero, peça inspirado ou escolha um pronto.', cta: 'Compor' },
  { href: '/catalogo', src: '/assets/flore-arranjo-2.png', title: 'Arranjos Prontos', desc: 'Composições autorais, prontas para encantar em até 24h.', cta: 'Ver catálogo' },
];

export default async function HomePage() {
  const [galleryPhotos, testimonials] = await Promise.all([getGalleryPhotos(), getTestimonials()]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <div style={{ position: 'relative', minHeight: 640, display: 'flex', alignItems: 'center', overflow: 'hidden', background: '#6B7C5C' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <Image src="/assets/flore-hero-box.jpg" alt="Composição floral autoral da Florê" fill priority style={{ objectFit: 'cover' }} />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background:
              'linear-gradient(100deg, rgba(75,87,64,0.92) 0%, rgba(75,87,64,0.78) 32%, rgba(75,87,64,0.15) 62%, rgba(75,87,64,0) 78%)',
          }}
        />
        <div
          className="animate-fadeUp"
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '60px clamp(28px,6vw,90px)',
            gap: 26,
            maxWidth: 640,
          }}
        >
          <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#E8C4B8' }}>Ateliê floral autoral</span>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(38px,5.2vw,64px)', lineHeight: 1.08, color: '#FAF7F2', margin: 0, fontStyle: 'italic', fontWeight: 500 }}>
            Onde o cuidado <br />
            floresce.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: '#EFE8DC', maxWidth: 440, fontWeight: 300 }}>
            Na Florê, cada composição floresce de um cuidado que começa antes da primeira flor — na escolha, no
            gesto, no tempo dedicado a cada detalhe. Assine e receba esse cuidado todo mês, ou componha o seu, flor
            a flor.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
            <Link href="/assinatura" style={{ background: '#FAF7F2', color: '#4B5740', border: 'none', padding: '15px 28px', borderRadius: 2, fontSize: 14, letterSpacing: 0.5 }}>
              Assine e Encante
            </Link>
            <Link href="/monte-seu-buque" style={{ background: 'transparent', color: '#FAF7F2', border: '1px solid rgba(250,247,242,0.6)', padding: '15px 28px', borderRadius: 2, fontSize: 14, letterSpacing: 0.5 }}>
              Monte seu Buquê
            </Link>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div style={{ padding: '90px 28px 40px', maxWidth: 1760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 50 }}>
          <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#C4836A' }}>Galeria</span>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,3vw,36px)', fontStyle: 'italic', color: '#4B5740', margin: '10px 0 12px' }}>
            Buquês reais da Florê
          </h2>
          <p style={{ fontSize: 15, color: '#7C7F6D', maxWidth: 560, margin: '0 auto' }}>
            Composições que já saíram do nosso ateliê — do dia a dia às ocasiões mais especiais. Clique em uma foto
            para usá-la como inspiração no seu pedido.
          </p>
        </div>
        <GalleryLightbox photos={galleryPhotos} />
      </div>

      {/* Escolha seu jeito de florir */}
      <div style={{ background: '#F3EDE3', padding: '80px 28px 90px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#C4836A' }}>Nossas formas de encantar</span>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,3vw,36px)', fontStyle: 'italic', color: '#4B5740', margin: '10px 0 12px' }}>
              Escolha o seu jeito de florir
            </h2>
            <p style={{ fontSize: 14, color: '#8A8D7C', maxWidth: 460, margin: '0 auto' }}>
              Escolha o formato → componha com carinho → receba no dia certo.
            </p>
          </div>
          <div className="cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28 }}>
            {categoryPreviews.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                style={{ background: '#FAF7F2', borderRadius: 2, overflow: 'hidden', display: 'block', boxShadow: '0 1px 3px rgba(75,87,64,0.08)' }}
              >
                <div style={{ position: 'relative', width: '100%', height: 220 }}>
                  <Image src={cat.src} alt={cat.title} fill style={{ objectFit: 'cover' }} />
                </div>
                <div style={{ padding: 24 }}>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontStyle: 'italic', color: '#4B5740', margin: '0 0 8px' }}>
                    {cat.title}
                  </h3>
                  <p style={{ fontSize: 14, color: '#7C7F6D', lineHeight: 1.6, margin: '0 0 14px' }}>{cat.desc}</p>
                  <span style={{ fontSize: 13, color: '#C4836A', letterSpacing: 0.3 }}>{cat.cta} →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Sobre a Florê */}
      <div className="about-grid" style={{ maxWidth: 1180, margin: '0 auto', padding: '100px 28px', display: 'grid', gridTemplateColumns: '0.55fr 1fr', gap: 56, alignItems: 'center' }}>
        <div style={{ position: 'relative', borderRadius: 2, overflow: 'hidden', aspectRatio: '4/5', width: '100%', maxWidth: 300, justifySelf: 'center' }}>
          <Image src="/assets/flore-evelyn-3.jpg" alt="Evelyn Martins" fill style={{ objectFit: 'cover' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#C4836A' }}>Sobre a Florê</span>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,3vw,38px)', fontStyle: 'italic', color: '#4B5740', margin: 0, lineHeight: 1.3 }}>
            Um ateliê que floresce em cada detalhe.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.85, color: '#5C5F51', fontWeight: 300 }}>
            A Florê Ateliê nasceu das mãos de <strong style={{ fontWeight: 500, color: '#4B5740' }}>Evelyn Martins</strong>, de um
            jeito bem simples de olhar para as flores: elas não são um presente qualquer, são um gesto de cuidado
            que a gente entrega inteiro. Cada composição carrega tempo, escolha e intenção — a flor certa, no ponto
            certo, para o momento certo. A Florê floresce assim, um arranjo de cada vez, sempre com a mesma
            pergunta guiando as mãos de Evelyn: isso vai fazer alguém sorrir?
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 16, color: '#4B5740' }}>Evelyn Martins</div>
              <div style={{ fontSize: 12, color: '#8A8D7C' }}>Idealizadora da Florê Ateliê</div>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div style={{ background: '#4B5740', padding: '100px 28px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#E8C4B8' }}>O que dizem</span>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,3vw,36px)', fontStyle: 'italic', color: '#FAF7F2', margin: '10px 0 56px' }}>
            Relatos de quem recebeu
          </h2>
          <div className="test-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 32, maxWidth: 820, margin: '0 auto' }}>
            {testimonials.map((t) => (
              <div
                key={t.id}
                style={{
                  background: 'rgba(250,247,242,0.06)',
                  border: '1px solid rgba(250,247,242,0.14)',
                  padding: '30px 26px',
                  borderRadius: 2,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, color: '#C4836A', lineHeight: 0.5 }}>&quot;</span>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: '#EFE8DC', margin: 0, fontStyle: 'italic' }}>{t.quote}</p>
                <span style={{ fontSize: 12, color: '#B9C0AA' }}>— {t.author_name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
