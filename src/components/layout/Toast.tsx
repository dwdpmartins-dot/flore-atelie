'use client';

import { useCart } from '@/lib/cart/CartContext';

export default function Toast() {
  const { toast } = useCart();
  if (!toast) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#3A3F32',
        color: '#FAF7F2',
        padding: '14px 22px',
        borderRadius: 2,
        fontSize: 13,
        zIndex: 60,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      }}
    >
      {toast}
    </div>
  );
}
