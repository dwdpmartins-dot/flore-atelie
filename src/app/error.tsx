'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section style={{ maxWidth: 520, margin: '0 auto', padding: '110px 28px 130px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#C4836A' }}>Algo não floresceu</span>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,40px)', fontStyle: 'italic', color: '#4B5740', margin: 0 }}>
        Precisamos de um instante.
      </h1>
      <p style={{ fontSize: 14.5, color: '#7C7F6D', lineHeight: 1.7, maxWidth: 380 }}>
        Algo deu errado do nosso lado. Tente novamente — se persistir, fale com a gente pelo WhatsApp.
      </p>
      <button onClick={reset} style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '14px 28px', borderRadius: 2, fontSize: 14, cursor: 'pointer' }}>
        Tentar novamente
      </button>
    </section>
  );
}
