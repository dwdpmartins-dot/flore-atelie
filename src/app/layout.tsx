import type { Metadata } from 'next';
import './globals.css';

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
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Work+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* META PIXEL: inserir código aqui */}
        {/* GOOGLE TAG MANAGER: inserir código aqui */}
      </head>
      <body>{children}</body>
    </html>
  );
}
