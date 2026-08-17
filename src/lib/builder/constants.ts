/**
 * Minimum total (sum of flower prices, before shipping) a "Monte seu
 * Buquê" composition must reach before it can be added to the cart.
 * Enforced in both places that matter: BouquetBuilder.tsx (client-side —
 * disables "Adicionar ao carrinho" and explains why) and
 * checkout/actions.ts's payAvulsoOrder (server-side — the cart is
 * client-managed state, so this is what actually prevents someone from
 * bypassing the UI and submitting an order with an under-minimum custom
 * bouquet).
 */
export const BUILDER_MIN_TOTAL = 100;
