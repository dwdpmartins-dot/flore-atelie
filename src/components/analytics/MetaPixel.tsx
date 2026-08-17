'use client';

import Script from 'next/script';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Meta Pixel base code -- loaded via next/script with strategy
 * "afterInteractive" instead of the raw <script> tag Meta gives you, so it
 * loads after the page is interactive and never blocks the initial
 * render, same pattern as every other third-party script in this app.
 * Renders nothing if NEXT_PUBLIC_META_PIXEL_ID isn't set, so the site
 * behaves the same as before this was added in any environment that
 * hasn't configured it (e.g. local dev without a .env.local).
 *
 * Fires the very first PageView on load. Client-side route changes (App
 * Router navigations never reload the page) are handled separately by
 * MetaPixelPageView, which needs useSearchParams -- kept out of this
 * component, and wrapped in its own <Suspense> in layout.tsx, so pages
 * that don't need it stay statically prerendered.
 */
export default function MetaPixel() {
  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
