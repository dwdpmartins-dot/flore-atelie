import { getFlowers, getSetting } from '@/lib/supabase/queries';
import BouquetBuilder from '@/components/builder/BouquetBuilder';

export const metadata = { title: 'Monte seu Buquê — Florê Ateliê' };

export default async function MonteSeuBuquePage() {
  const [flowers, aiEnabled] = await Promise.all([getFlowers(), getSetting<boolean>('ai_illustration_enabled')]);

  return (
    <section style={{ maxWidth: 1320, margin: '0 auto', padding: '50px 24px 110px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#C4836A' }}>Monte seu Buquê</span>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,4vw,38px)', fontStyle: 'italic', color: '#4B5740', margin: '10px 0 8px' }}>
          Componha, flor a flor
        </h1>
        <p style={{ fontSize: 14, color: '#7C7F6D' }}>Arraste as flores para o vaso, ou toque no &quot;+&quot;. O preview se monta na hora.</p>
      </div>
      <BouquetBuilder flowers={flowers} aiEnabled={aiEnabled === true} />
    </section>
  );
}
