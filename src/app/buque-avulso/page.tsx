import { Suspense } from 'react';
import { getGalleryPhotos, getSetting } from '@/lib/supabase/queries';
import AvulsoModes from '@/components/avulso/AvulsoModes';

export const metadata = { title: 'Buquê Avulso — Florê Ateliê' };

// The "Prontos" mode (a small hand-picked set of ready-made bouquets) was
// removed once /catalogo grew to cover the same ground properly with 17
// real products -- keeping both was redundant. See AvulsoModes.tsx.
export default async function BuqueAvulsoPage() {
  const [galleryPhotos, inspiradoDefaultPrices] = await Promise.all([
    getGalleryPhotos(),
    getSetting<{ P: number; M: number; G: number }>('inspirado_default_prices'),
  ]);

  return (
    <Suspense>
      <AvulsoModes galleryPhotos={galleryPhotos} inspiradoDefaultPrices={inspiradoDefaultPrices ?? { P: 99, M: 139, G: 189 }} />
    </Suspense>
  );
}
