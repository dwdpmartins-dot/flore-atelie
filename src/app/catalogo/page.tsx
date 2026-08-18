import Link from 'next/link';
import { getCatalogBouquets } from '@/lib/supabase/queries';
import CatalogGrid from '@/components/catalog/CatalogGrid';

export const metadata = { title: 'Catálogo — Florê Ateliê' };

export default async function CatalogoPage() {
  const bouquets = await getCatalogBouquets();

  return (
    <section style={{ maxWidth: 1240, margin: '0 auto', padding: '64px 28px 100px' }}>
      <div style={{ textAlign: 'center', marginBottom: 50 }}>
        <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#C4836A' }}>Catálogo</span>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,42px)', fontStyle: 'italic', color: '#4B5740', margin: '10px 0 12px' }}>
          Buquês e arranjos autorais
        </h1>
        <p style={{ fontSize: 15, color: '#7C7F6D', maxWidth: 560, margin: '0 auto' }}>
          Composições já prontas para encantar, com entrega em até 24 horas. Prefere escolher flor a flor?{' '}
          <Link href="/monte-seu-buque">Monte seu buquê</Link>.
        </p>
      </div>
      <CatalogGrid bouquets={bouquets} />
    </section>
  );
}
