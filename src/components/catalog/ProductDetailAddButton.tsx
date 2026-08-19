'use client';

import { useCart } from '@/lib/cart/CartContext';

/**
 * Same "Adicionar" behavior as ProductGrid's card button (1 unit, merges
 * by key if already in the cart, no toast — matches that button exactly)
 * — just its own component since this page is a Server Component and
 * needs a client boundary for useCart().
 */
export default function ProductDetailAddButton({ id, name, price }: { id: string; name: string; price: number }) {
  const { addToCart } = useCart();

  return (
    <button
      onClick={() => addToCart({ key: 'catalogo-' + id, label: name, price, kind: 'Catálogo' })}
      style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '15px 32px', borderRadius: 2, fontSize: 14, letterSpacing: 0.3, cursor: 'pointer' }}
    >
      Adicionar ao carrinho
    </button>
  );
}
