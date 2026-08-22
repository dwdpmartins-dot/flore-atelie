import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { CartProvider } from '@/lib/cart/CartContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppFloat from '@/components/layout/WhatsAppFloat';
import Toast from '@/components/layout/Toast';
import MetaPixel from '@/components/analytics/MetaPixel';
import MetaPixelPageView from '@/components/analytics/MetaPixelPageView';
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics';
import GoogleAnalyticsPageView from '@/components/analytics/GoogleAnalyticsPageView';

export const metadata: Metadata = {
  title: 'Florê Ateliê — Boutique Floral Artesanal',
  description:
    'Assine e encante, ou componha seu próprio buquê: a Florê Ateliê é uma boutique floral artesanal brasileira, idealizada por Evelyn Martins.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/*
          This is the App Router root layout, not a Pages Router page, so it
          already applies to every route (the no-page-custom-font rule's
          "only loads for a single page" concern doesn't apply here). Not
          migrating to next/font/google because dozens of components already
          reference these font-family strings inline by name; swapping
          loaders would mean touching every one of them for a cosmetic-only
          change.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Work+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <MetaPixel />
        <GoogleAnalytics />
        {/* useSearchParams (inside MetaPixelPageView/GoogleAnalyticsPageView)
            needs its own Suspense boundary or every page in the app loses
            static prerendering -- scoping it here keeps that cost limited
            to just these components, same reasoning as Header fetching its
            own auth state client-side instead of a cookies() call up here. */}
        <Suspense fallback={null}>
          <MetaPixelPageView />
          <GoogleAnalyticsPageView />
        </Suspense>
        <CartProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Header fetches its own auth state client-side (see
                Header.tsx) instead of the root layout calling cookies()
                server-side — that would force every route in the app,
                including static marketing pages, into dynamic rendering. */}
            <Header />
            <main style={{ flex: 1 }}>{children}</main>
            <Footer />
          </div>
          <WhatsAppFloat />
          <Toast />
        </CartProvider>
      </body>
    </html>
  );
}
