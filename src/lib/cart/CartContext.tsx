'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface CartItem {
  key: string;
  label: string;
  price: number;
  qty: number;
  kind: string; // e.g. 'Catálogo', 'Buquê Avulso · Pronto', 'Monte seu Buquê'
}

interface CartContextValue {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (item: Omit<CartItem, 'qty'> & { qty?: number }) => void;
  removeFromCart: (key: string) => void;
  updateQty: (key: string, qty: number) => void;
  clearCart: () => void;
  toast: string | null;
  showToast: (message: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'flore-cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const addToCart: CartContextValue['addToCart'] = useCallback(
    (item) => {
      setCart((prev) => {
        const existing = prev.find((c) => c.key === item.key);
        if (existing) {
          return prev.map((c) => (c.key === item.key ? { ...c, qty: c.qty + (item.qty ?? 1) } : c));
        }
        return [...prev, { ...item, qty: item.qty ?? 1 }];
      });
      showToast(`${item.label} adicionado ao carrinho.`);
    },
    [showToast]
  );

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const updateQty = useCallback((key: string, qty: number) => {
    setCart((prev) =>
      qty <= 0 ? prev.filter((c) => c.key !== key) : prev.map((c) => (c.key === key ? { ...c, qty } : c))
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = useMemo(() => cart.reduce((a, c) => a + c.qty, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((a, c) => a + c.qty * c.price, 0), [cart]);

  return (
    <CartContext.Provider
      value={{ cart, cartCount, cartTotal, addToCart, removeFromCart, updateQty, clearCart, toast, showToast }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
