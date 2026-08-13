'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Database } from '@/lib/supabase/types';

type GalleryPhoto = Database['public']['Tables']['gallery_photos']['Row'];

export default function GalleryLightbox({ photos }: { photos: GalleryPhoto[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const active = openIdx != null ? photos[openIdx] : null;

  return (
    <>
      <div className="gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 18 }}>
        {photos.map((g, idx) => (
          <div
            key={g.id}
            onClick={() => setOpenIdx(idx)}
            className="gallery-hover-item"
            style={{ position: 'relative', borderRadius: 2, overflow: 'hidden', aspectRatio: '3/4', cursor: 'pointer' }}
          >
            <Image src={g.image_path} alt={g.caption} fill sizes="(max-width: 860px) 50vw, 20vw" style={{ objectFit: 'cover' }} />
            <div
              className="gallery-hover-overlay"
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(0deg,rgba(43,49,36,0.55),transparent 45%)',
                opacity: 0,
                transition: 'opacity 0.25s',
                display: 'flex',
                alignItems: 'flex-end',
                padding: 14,
                pointerEvents: 'none',
              }}
            >
              <span style={{ color: '#FAF7F2', fontSize: 12, letterSpacing: 0.5 }}>Usar como inspiração →</span>
            </div>
          </div>
        ))}
      </div>

      {active && (
        <div
          onClick={() => setOpenIdx(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(43,49,36,0.9)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 30,
            overflowY: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="lightbox-grid"
            style={{
              background: '#FAF7F2',
              maxWidth: 820,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 2,
              display: 'grid',
              gridTemplateColumns: '1.1fr 1fr',
              alignItems: 'start',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setOpenIdx(null)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 10,
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(43,49,36,0.55)',
                border: 'none',
                color: '#FAF7F2',
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
            <div className="lightbox-photo" style={{ width: '100%', maxHeight: '90vh', aspectRatio: '4/5', alignSelf: 'start', position: 'relative' }}>
              <Image src={active.image_path} alt={active.caption} fill style={{ objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
              <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#C4836A' }}>Referência da galeria</span>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 22, color: '#4B5740', margin: 0 }}>
                {active.caption}
              </h3>
              <p style={{ fontSize: 13.5, color: '#7C7F6D', lineHeight: 1.75, margin: 0 }}>
                Gostou dessa composição? Leve essa referência para o pedido &quot;Buquê Inspirado da Florê&quot; e nossa
                equipe monta algo no mesmo espírito para você — ou use como ponto de partida no &quot;Monte seu
                Buquê&quot;.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <Link
                  href={`/buque-avulso?modo=inspirado&ref=${active.id}`}
                  style={{ background: '#4B5740', color: '#FAF7F2', textAlign: 'center', padding: 13, borderRadius: 2, fontSize: 13 }}
                >
                  Pedir algo parecido
                </Link>
                <Link
                  href="/monte-seu-buque"
                  style={{ background: 'none', border: '1px solid #4B5740', color: '#4B5740', textAlign: 'center', padding: 13, borderRadius: 2, fontSize: 13 }}
                >
                  Montar meu buquê
                </Link>
              </div>
              <button onClick={() => setOpenIdx(null)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#8A8D7C', fontSize: 12.5, cursor: 'pointer', marginTop: 4 }}>
                Fechar ×
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
