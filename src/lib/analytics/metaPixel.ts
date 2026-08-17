declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Fires a Meta Pixel event via the global fbq() the base script installs
 * (see components/analytics/MetaPixel.tsx). No-ops if the pixel hasn't
 * loaded -- no NEXT_PUBLIC_META_PIXEL_ID configured, an ad blocker, or the
 * script just hasn't finished loading yet -- so callers don't need to
 * guard for that themselves.
 *
 * Wired up so far: PageView only, fired automatically (see MetaPixel.tsx
 * and MetaPixelPageView.tsx). Purchase / InitiateCheckout / AddToCart are
 * deliberately not called from anywhere yet, per the request to prepare
 * the plumbing without wiring conversion events into checkout/webhook/
 * builder logic in this pass -- this is the shared entry point for adding
 * those next.
 */
export function trackMetaPixelEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('track', event, params);
}
