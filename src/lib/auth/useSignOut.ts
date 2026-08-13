'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/lib/cart/CartContext';

/**
 * Shared sign-out logic (auth + cart cleanup + redirect), reused by every
 * "Sair" control in the app (Minha Conta, the header's account menu) so
 * they can't drift out of sync with each other.
 */
export function useSignOut() {
  const router = useRouter();
  const { clearCart } = useCart();

  return async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // The cart lives in localStorage, unscoped to any account — on a
    // shared/public computer, the next person to log in would otherwise
    // see whatever the previous person left in their cart.
    clearCart();
    router.replace('/minha-conta');
    router.refresh();
  };
}
