import { Suspense } from 'react';
import { getBouquets, getGalleryPhotos, getSetting } from '@/lib/supabase/queries';
import AvulsoModes from '@/components/avulso/AvulsoModes';

export const metadata = { title: 'Buquê Avulso — Florê Ateliê' };

export default async function BuqueAvulsoPage() {
  const [readyOptions, galleryPhotos, inspiradoDefaultPrices] = await Promise.all([
    getBouquets('avulso_pronto'),
    getGalleryPhotos(),
    getSetting<{ P: number; M: number; G: number }>('inspirado_default_prices'),
  ]);

  return (
    <Suspense>
      <AvulsoModes
        readyOptions={readyOptions}
        galleryPhotos={galleryPhotos}
        inspiradoDefaultPrices={inspiradoDefaultPrices ?? { P: 99, M: 139, G: 189 }}
      />
    </Suspense>
  );
}
