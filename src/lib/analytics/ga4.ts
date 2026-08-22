declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Fires a GA4 event via the global gtag() the base script installs (see
 * components/analytics/GoogleAnalytics.tsx). No-ops if it hasn't loaded --
 * no NEXT_PUBLIC_GA_MEASUREMENT_ID configured, an ad blocker, or the
 * script just hasn't finished loading yet -- so callers don't need to
 * guard for that themselves. Deliberately separate from
 * lib/analytics/metaPixel.ts (different global, different event shape,
 * different platform to debug independently) rather than one shared
 * "analytics" abstraction over both.
 */
export function trackGA4Event(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', event, params);
}
