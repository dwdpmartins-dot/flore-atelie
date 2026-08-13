'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useCart } from '@/lib/cart/CartContext';
import type { Database } from '@/lib/supabase/types';

type Bouquet = Database['public']['Tables']['bouquets']['Row'];

export default function CatalogGrid({ bouquets }: { bouquets: Bouquet[] }) {
  const { addToCart } = useCart();
  const [qty, setQty] = useState<Record<string, number>>({});

  const qtyOf = (id: string) => qty[id] ?? 1;
  const setQtyOf = (id: string, v: number) => setQty((s) => ({ ...s, [id]: Math.max(1, v) }));

  return (
    <div className="cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 30 }}>
      {bouquets.map((b) => (
        <div key={b.id} style={{ background: '#FFFFFF', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 4px rgba(75,87,64,0.08)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', width: '100%', height: 230 }}>
            <Image src={b.image_path} alt={b.name} fill style={{ objectFit: 'cover' }} />
          </div>
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontStyle: 'italic', color: '#4B5740', margin: 0 }}>{b.name}</h3>
            <p style={{ fontSize: 13, color: '#7C7F6D', lineHeight: 1.6, margin: 0, flex: 1 }}>{b.description}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: '#4B5740' }}>R$ {b.price}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #D8CFC0', borderRadius: 2, padding: '4px 8px' }}>
                  <button onClick={() => setQtyOf(b.id, qtyOf(b.id) - 1)} style={{ background: 'none', border: 'none', color: '#4B5740', fontSize: 15, cursor: 'pointer', width: 18 }}>
                    −
                  </button>
                  <span style={{ fontSize: 13, color: '#4B5740', minWidth: 14, textAlign: 'center' }}>{qtyOf(b.id)}</span>
                  <button onClick={() => setQtyOf(b.id, qtyOf(b.id) + 1)} style={{ background: 'none', border: 'none', color: '#4B5740', fontSize: 15, cursor: 'pointer', width: 18 }}>
                    +
                  </button>
                </div>
                <button
                  onClick={() =>
                    addToCart({ key: 'catalogo-' + b.id, label: b.name, price: b.price, qty: qtyOf(b.id), kind: 'Catálogo' })
                  }
                  style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '10px 16px', borderRadius: 2, fontSize: 12, letterSpacing: 0.3, cursor: 'pointer' }}
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
