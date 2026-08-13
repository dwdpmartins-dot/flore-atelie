import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface CompositionItem {
  name: string;
  qty: number;
}

/**
 * Generates the paid AI illustration for a composed bouquet (Monte seu
 * Buquê). The free layered-SVG canvas preview never hits this route — this
 * is only called when the customer explicitly clicks "Gerar minha
 * ilustração", and only rendered at all when ai_illustration_enabled is on.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: setting } = await supabase.from('settings').select('value').eq('key', 'ai_illustration_enabled').maybeSingle();
  if (setting?.value !== true) {
    return NextResponse.json({ error: 'Ilustração por IA está desativada no momento.' }, { status: 403 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Geração de ilustração indisponível no momento.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const composition: CompositionItem[] = Array.isArray(body?.composition) ? body.composition : [];
  const message: string = typeof body?.message === 'string' ? body.message : '';

  if (composition.length === 0) {
    return NextResponse.json({ error: 'Escolha ao menos uma flor antes de gerar a ilustração.' }, { status: 400 });
  }

  const flowerList = composition.map((c) => `${c.qty}x ${c.name}`).join(', ');
  const prompt = [
    'Editorial watercolor-style illustration of an artisanal flower bouquet, boutique floral photography aesthetic.',
    `The bouquet must contain exactly these flowers, in these quantities, and no others: ${flowerList}.`,
    'Wrapped in warm kraft-paper/terracotta paper, soft natural light, warm neutral cream background.',
    'Palette: moss green, terracotta, dusty pink. No text, no watermark, no people, no vase — just the wrapped bouquet.',
    message ? `Mood suggested by the card message: "${message.slice(0, 120)}".` : '',
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      quality: 'medium',
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error('Sem imagem retornada pela OpenAI.');
    const bytes = Buffer.from(b64, 'base64');

    // Persist to Supabase Storage so the illustration survives past this
    // request (order history, admin view) instead of only living in the
    // browser tab as a data URL.
    const admin = createAdminClient();
    const path = `builder/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error: uploadError } = await admin.storage.from('illustrations').upload(path, bytes, {
      contentType: 'image/png',
      upsert: false,
    });

    if (uploadError) {
      // Storage bucket may not exist yet in a not-fully-provisioned project
      // (see 0005_storage.sql) — fall back to returning the image inline
      // rather than failing the whole request.
      return NextResponse.json({ imageUrl: `data:image/png;base64,${b64}` });
    }

    const { data: publicUrl } = admin.storage.from('illustrations').getPublicUrl(path);
    return NextResponse.json({ imageUrl: publicUrl.publicUrl });
  } catch (err) {
    console.error('generate-illustration failed', err);
    return NextResponse.json({ error: 'Não foi possível gerar a ilustração agora.' }, { status: 502 });
  }
}
