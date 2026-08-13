'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/lib/cart/CartContext';

export default function SignOutButton() {
  const router = useRouter();
  const { clearCart } = useCart();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // The cart lives in localStorage, unscoped to any account — on a
    // shared/public computer, the next person to log in would otherwise
    // see whatever the previous person left in their cart.
    clearCart();
    router.replace('/minha-conta');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      style={{
        background: 'none',
        border: '1px solid #D8CFC0',
        color: '#7C7F6D',
        padding: '8px 16px',
        borderRadius: '2px',
        fontSize: '12px',
        cursor: 'pointer',
      }}
    >
      Sair
    </button>
  );
}
