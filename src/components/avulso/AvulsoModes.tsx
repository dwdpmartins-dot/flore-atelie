'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/lib/cart/CartContext';
import type { Database } from '@/lib/supabase/types';

type GalleryPhoto = Database['public']['Tables']['gallery_photos']['Row'];
type Size = 'P' | 'M' | 'G';

const MODES = [
  { key: 'zero', label: 'Montar do zero' },
  { key: 'inspirado', label: 'Inspirado da Florê' },
] as const;

// Shown when the customer opens "Inspirado da Florê" directly (no gallery
// reference chosen via ?ref=) — matches the prototype's own fallback
// (referencePhotoSrc), so the photo box is never left empty.
const DEFAULT_INSPIRADO_IMAGE = '/assets/flore-arranjo-4.png';

export default function AvulsoModes({
  galleryPhotos,
  inspiradoDefaultPrices,
}: {
  galleryPhotos: GalleryPhoto[];
  inspiradoDefaultPrices: Record<Size, number>;
}) {
  const searchParams = useSearchParams();
  // Old bookmarked/shared links may still carry ?modo=pronto (removed) —
  // fall back to 'zero' instead of landing on a mode that no longer exists.
  const requestedMode = searchParams.get('modo');
  const initialMode = MODES.some((m) => m.key === requestedMode) ? (requestedMode as (typeof MODES)[number]['key']) : 'zero';
  const refId = searchParams.get('ref');

  const [mode, setMode] = useState<(typeof MODES)[number]['key']>(initialMode);
  const [size, setSize] = useState<Size>('M');
  const { addToCart } = useCart();

  const reference = useMemo(() => galleryPhotos.find((g) => g.id === refId) ?? null, [galleryPhotos, refId]);

  const inspiradoPrices: Record<Size, number> = reference
    ? { P: reference.price_p, M: reference.price_m, G: reference.price_g }
    : inspiradoDefaultPrices;

  return (
    <section style={{ maxWidth: 1080, margin: '0 auto', padding: '64px 28px 100px' }}>
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#C4836A' }}>Buquê Avulso</span>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,42px)', fontStyle: 'italic', color: '#4B5740', margin: '10px 0 12px' }}>
          Escolha sua forma de pedir
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 48, flexWrap: 'wrap' }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              padding: '12px 22px',
              borderRadius: 2,
              border: '1px solid #4B5740',
              background: mode === m.key ? '#4B5740' : 'transparent',
              color: mode === m.key ? '#FAF7F2' : '#4B5740',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'zero' && (
        <div style={{ textAlign: 'center', background: '#F3EDE3', padding: '50px 30px', borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <p style={{ fontSize: 15, color: '#5C5F51', maxWidth: 460, lineHeight: 1.7 }}>
            Escolha cada flor, veja a composição se formar em camadas e finalize com uma ilustração gerada
            especialmente para o seu buquê.
          </p>
          <Link href="/monte-seu-buque" style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '15px 30px', borderRadius: 2, fontSize: 14 }}>
            Ir para o compositor →
          </Link>
        </div>
      )}

      {mode === 'inspirado' && (
        <div className="inspirado-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', height: 320, borderRadius: 2, overflow: 'hidden', background: '#EFE6D8' }}>
            <Image
              src={reference ? reference.image_path : DEFAULT_INSPIRADO_IMAGE}
              alt={reference ? reference.caption : 'Buquê Inspirado da Florê'}
              fill
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {reference && (
              <p style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#C4836A', margin: 0 }}>
                Referência escolhida: {reference.caption}
              </p>
            )}
            <p style={{ fontSize: 15, color: '#5C5F51', lineHeight: 1.7 }}>
              Escolha apenas o tamanho — nossa equipe monta um arranjo autoral com as flores da estação, na paleta
              da Florê.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['P', 'M', 'G'] as Size[]).map((sz) => (
                <button
                  key={sz}
                  onClick={() => setSize(sz)}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: '1px solid #4B5740',
                    background: size === sz ? '#4B5740' : 'transparent',
                    color: size === sz ? '#FAF7F2' : '#4B5740',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  {sz}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#4B5740' }}>R$ {inspiradoPrices[size]}</span>
              <button
                onClick={() =>
                  addToCart({
                    key: 'inspirado-' + size + (reference ? '-' + reference.id : ''),
                    label: 'Buquê Inspirado da Florê (' + size + ')' + (reference ? ` — ref. "${reference.caption}"` : ''),
                    price: inspiradoPrices[size],
                    kind: 'Buquê Avulso · Inspirado',
                  })
                }
                style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '14px 26px', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}
              >
                Adicionar ao carrinho
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
