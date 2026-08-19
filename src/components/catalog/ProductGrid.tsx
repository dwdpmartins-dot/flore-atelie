'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/cart/CartContext';
import type { Database } from '@/lib/supabase/types';

type Bouquet = Database['public']['Tables']['bouquets']['Row'];

/**
 * Product card grid shared by /catalogo and the home page's "Buquês reais
 * da Florê" section — same card shape in both places. No quantity
 * stepper here (that only lives inside the cart now): "Adicionar" always
 * adds exactly 1 unit, and addToCart merges by key, so adding the same
 * product again (from here, the other grid, or the detail page) just
 * increments the existing cart line instead of creating a duplicate.
 * The photo/name link to /catalogo/[slug] for the full product page.
 */
export default function ProductGrid({ bouquets }: { bouquets: Bouquet[] }) {
  const { addToCart } = useCart();

  return (
    <div className="cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 30 }}>
      {bouquets.map((b) => (
        <div key={b.id} style={{ background: '#FFFFFF', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 4px rgba(75,87,64,0.08)', display: 'flex', flexDirection: 'column' }}>
          <Link href={`/catalogo/${b.id}`} style={{ position: 'relative', width: '100%', height: 230, display: 'block' }}>
            <Image src={b.image_path} alt={b.name} fill style={{ objectFit: 'cover' }} />
          </Link>
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <Link href={`/catalogo/${b.id}`}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontStyle: 'italic', color: '#4B5740', margin: 0 }}>{b.name}</h3>
            </Link>
            <p style={{ fontSize: 13, color: '#7C7F6D', lineHeight: 1.6, margin: 0, flex: 1 }}>{b.description}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: '#4B5740' }}>R$ {b.price}</span>
              <button
                onClick={() => addToCart({ key: 'catalogo-' + b.id, label: b.name, price: b.price, kind: 'Catálogo' })}
                style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '10px 16px', borderRadius: 2, fontSize: 12, letterSpacing: 0.3, cursor: 'pointer' }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
