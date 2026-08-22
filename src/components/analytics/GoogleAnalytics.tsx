'use client';

import Script from 'next/script';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Google Analytics 4 base code -- loaded via next/script with strategy
 * "afterInteractive" instead of the raw <script> tag Google gives you,
 * same pattern (and same reasoning) as MetaPixel.tsx: loads after the
 * page is interactive, never blocks the initial render. Kept in its own
 * file rather than merged with the Meta Pixel component so either
 * platform's plumbing can be edited or ripped out without touching the
 * other. Renders nothing if NEXT_PUBLIC_GA_MEASUREMENT_ID isn't set.
 *
 * Two scripts, matching Google's own snippet: the external gtag.js
 * loader, then a small inline script that creates window.dataLayer and
 * calls gtag('js', ...) + gtag('config', ...) -- that config call also
 * fires GA4's own first page_view automatically. Client-side route
 * changes (App Router navigations never reload the page) are handled
 * separately by GoogleAnalyticsPageView, same reasoning as
 * MetaPixelPageView.
 */
export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga4-base" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
