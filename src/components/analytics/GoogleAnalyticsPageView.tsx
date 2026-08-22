'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackGA4Event } from '@/lib/analytics/ga4';

/**
 * Re-fires page_view on every client-side route change. The base script
 * (GoogleAnalytics.tsx) only fires the first page_view automatically, as
 * part of its gtag('config', ...) call -- App Router navigations don't
 * reload the page, so without this every navigation after the first would
 * go untracked. Exact mirror of MetaPixelPageView's structure.
 *
 * Needs useSearchParams, which requires a <Suspense> boundary -- see
 * layout.tsx, which already wraps MetaPixelPageView in one; this reuses
 * that same boundary instead of opening a second one.
 */
export default function GoogleAnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    trackGA4Event('page_view', {
      page_path: query ? `${pathname}?${query}` : pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
    // Intentionally re-runs on every path/query change; the base script
    // already covers the very first page_view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  return null;
}
