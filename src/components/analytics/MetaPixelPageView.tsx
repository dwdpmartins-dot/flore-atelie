'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackMetaPixelEvent } from '@/lib/analytics/metaPixel';

/**
 * Re-fires PageView on every client-side route change. The base script
 * (MetaPixel.tsx) only fires PageView once, on the initial page load --
 * App Router navigations don't reload the page, so without this every
 * navigation after the first would go untracked.
 *
 * Needs useSearchParams, which requires a <Suspense> boundary around
 * whatever uses it or the page it's rendered from can't be statically
 * prerendered -- see layout.tsx, where this is wrapped in its own
 * Suspense so that requirement stays scoped to just this component
 * instead of de-opting every page in the app.
 */
export default function MetaPixelPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    trackMetaPixelEvent('PageView');
    // Intentionally re-runs on every path/query change; the base script
    // already covers the very first PageView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  return null;
}
