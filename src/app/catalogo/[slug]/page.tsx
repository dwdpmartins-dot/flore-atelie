import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getBouquetBySlug } from '@/lib/supabase/queries';
import ProductDetailAddButton from '@/components/catalog/ProductDetailAddButton';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getBouquetBySlug(slug);
  return { title: product ? `${product.name} — Florê Ateliê` : 'Produto — Florê Ateliê' };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getBouquetBySlug(slug);
  if (!product) notFound();

  return (
    <section style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 28px 100px' }}>
      <Link href="/catalogo" style={{ fontSize: 13, color: '#7C7F6D' }}>
        ← Voltar ao catálogo
      </Link>
      <div className="product-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, marginTop: 24, alignItems: 'start' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 2, overflow: 'hidden', boxShadow: '0 4px 20px rgba(75,87,64,0.1)' }}>
          <Image src={product.image_path} alt={product.name} fill priority style={{ objectFit: 'cover' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 8 }}>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,3.5vw,38px)', fontStyle: 'italic', color: '#4B5740', margin: 0 }}>
            {product.name}
          </h1>
          <p style={{ fontSize: 15, color: '#7C7F6D', lineHeight: 1.8, margin: 0 }}>{product.description}</p>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: '#4B5740' }}>R$ {product.price}</span>
          <div>
            <ProductDetailAddButton id={product.id} name={product.name} price={product.price} />
          </div>
          <p style={{ fontSize: 12.5, color: '#A7AB97', margin: 0 }}>Entrega em até 24 horas, de segunda a sábado.</p>
        </div>
      </div>
    </section>
  );
}
