'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart/CartContext';
import { getFlowerVisual } from '@/lib/builder/flowerVisuals';
import { BUILDER_MIN_TOTAL } from '@/lib/builder/constants';
import { useScrollToTopOnChange } from '@/lib/hooks/useScrollToTopOnChange';
import FlowerSvg from './FlowerSvg';
import type { Database } from '@/lib/supabase/types';

type Flower = Database['public']['Tables']['flowers']['Row'];

interface PlacedFlower {
  seed: number;
  flowerId: string;
}

interface LayoutFlower extends PlacedFlower {
  x: number;
  y: number;
  rot: number;
  scale: number;
  zIndex: number;
}

let seedCounter = 0;

/**
 * Deterministic pseudo-random value in [0,1) from a seed — a sine-based
 * hash, ported verbatim from the prototype's builderVals() so replayed
 * seeds always land on the same "random" values.
 */
function seededRand(n: number): number {
  const x = Math.sin(n * 999.7 + 13.1) * 10000;
  return x - Math.floor(x);
}

/**
 * Fan/arc layout, ported verbatim from the prototype (project/Flore
 * Atelie.dc.html, builderVals()): every placed flower's angle is spread
 * evenly across a ~190° arc (-95° to +95°) by its index among the *current*
 * total N, so the whole bouquet reflows and re-spreads every time a flower
 * is added or removed — never just stacking the newest one in the middle.
 * Radius/rotation/scale add per-flower jitter (seeded, so stable across
 * re-renders) for a layered, hand-arranged look instead of a flat comb.
 * A manual drag (positionOverrides) pins a flower in place regardless.
 */
function computeLayout(placed: PlacedFlower[], overrides: Record<number, { x: number; y: number }>): LayoutFlower[] {
  const N = placed.length;
  return placed.map((p, idx) => {
    const angle = -95 + (N <= 1 ? 0 : (idx / (N - 1)) * 190) + (seededRand(p.seed) - 0.5) * 16;
    const radius = 58 + seededRand(p.seed + 1) * 66;
    const rad = (angle * Math.PI) / 180;
    const override = overrides[p.seed];
    const x = override ? override.x : Math.sin(rad) * radius;
    const y = override ? override.y : -Math.abs(Math.cos(rad)) * radius * 0.68;
    const rot = (seededRand(p.seed + 2) - 0.5) * 36;
    const scale = 0.82 + seededRand(p.seed + 3) * 0.4;
    return { ...p, x, y, rot, scale, zIndex: idx };
  });
}

export default function BouquetBuilder({ flowers, aiEnabled }: { flowers: Flower[]; aiEnabled: boolean }) {
  const { addToCart } = useCart();
  const router = useRouter();

  const [placed, setPlaced] = useState<PlacedFlower[]>([]);
  const [positionOverrides, setPositionOverrides] = useState<Record<number, { x: number; y: number }>>({});
  const [message, setMessage] = useState('');
  const [stage, setStage] = useState<'build' | 'generating' | 'result'>('build');
  const [illustrationUrl, setIllustrationUrl] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState('');

  // "build" -> "generating" -> "result" swap to drastically different page
  // heights; without this, clicking "Gerar minha ilustração" left the
  // viewport pointed at the old scroll offset, which usually landed on the
  // footer instead of the (now much shorter) "generating…" view.
  useScrollToTopOnChange([stage]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ seed: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const flowerById = (id: string) => flowers.find((f) => f.id === id);
  const layout = computeLayout(placed, positionOverrides);

  function placeNewFlower(flowerId: string) {
    setPlaced((prev) => [...prev, { seed: seedCounter++, flowerId }]);
  }

  function addFlower(flowerId: string) {
    placeNewFlower(flowerId);
  }

  function removeFlower(flowerId: string) {
    setPlaced((prev) => {
      const idx = [...prev].reverse().findIndex((p) => p.flowerId === flowerId);
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.filter((_, i) => i !== realIdx);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const flowerId = e.dataTransfer.getData('text/flower');
    if (flowerId) placeNewFlower(flowerId);
  }

  function startDrag(e: React.PointerEvent, p: LayoutFlower) {
    e.stopPropagation();
    dragState.current = { seed: p.seed, startX: e.clientX, startY: e.clientY, originX: p.x, originY: p.y };
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    const drag = dragState.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setPositionOverrides((prev) => ({ ...prev, [drag.seed]: { x: drag.originX + dx, y: drag.originY + dy } }));
  }

  function endDrag() {
    dragState.current = null;
  }

  const chosen = Object.values(
    placed.reduce<Record<string, { flowerId: string; qty: number }>>((acc, p) => {
      acc[p.flowerId] = acc[p.flowerId] || { flowerId: p.flowerId, qty: 0 };
      acc[p.flowerId].qty += 1;
      return acc;
    }, {})
  );
  const total = chosen.reduce((sum, c) => sum + c.qty * (flowerById(c.flowerId)?.price ?? 0), 0);
  const hasFlowers = chosen.length > 0;
  const belowMinimum = hasFlowers && total < BUILDER_MIN_TOTAL;
  const canAddToCart = hasFlowers && !belowMinimum;

  function resetBuilder() {
    setPlaced([]);
    setPositionOverrides({});
    setMessage('');
    setStage('build');
    setIllustrationUrl(null);
    setGenerateError('');
  }

  function cartLabel() {
    const items = chosen.map((c) => `${c.qty}x ${flowerById(c.flowerId)?.name}`).join(', ');
    return `Buquê Montado (${items})`;
  }

  function handleAddToCart() {
    if (belowMinimum) return;
    addToCart({
      key: 'custom-' + Date.now(),
      label: cartLabel(),
      price: total,
      kind: 'Monte seu Buquê',
    });
    router.push('/checkout');
  }

  async function handleGenerateIllustration() {
    setStage('generating');
    setGenerateError('');
    try {
      const res = await fetch('/api/builder/generate-illustration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          composition: chosen.map((c) => ({ name: flowerById(c.flowerId)?.name, qty: c.qty })),
          message,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setIllustrationUrl(data.imageUrl);
      setStage('result');
    } catch {
      setGenerateError('Não foi possível gerar a ilustração agora. Você ainda pode adicionar o buquê ao carrinho.');
      setStage('build');
    }
  }

  if (stage === 'generating') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '100px 0' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '3px solid #E8C4B8',
            borderTopColor: '#C4836A',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <p style={{ fontSize: 14, color: '#7C7F6D' }}>Gerando sua ilustração, com exatamente as flores escolhidas…</p>
      </div>
    );
  }

  if (stage === 'result' && illustrationUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, maxWidth: 520, margin: '0 auto' }}>
        <div style={{ width: '100%', padding: '8px 8px 0', background: '#FFFFFF', borderRadius: 4, boxShadow: '0 6px 24px rgba(75,87,64,0.14)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={illustrationUrl}
            alt="Ilustração do seu buquê"
            style={{ width: '100%', height: 420, objectFit: 'cover', borderRadius: 2, display: 'block' }}
          />
          <div style={{ padding: '14px 6px 18px', textAlign: 'center' }}>
            <span style={{ fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', color: '#C4836A' }}>Ilustração gerada por IA</span>
            <p style={{ fontSize: 12.5, color: '#8A8D7C', margin: '6px 0 0' }}>
              Representação do seu buquê no estilo Florê, com exatamente as flores e quantidades escolhidas.
            </p>
          </div>
        </div>
        {belowMinimum && (
          <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0, textAlign: 'center' }}>
            O valor mínimo do buquê é R$ {BUILDER_MIN_TOTAL} — faltam R$ {(BUILDER_MIN_TOTAL - total).toFixed(2)} em flores.
          </p>
        )}
        <div style={{ display: 'flex', gap: 14 }}>
          <button onClick={resetBuilder} style={{ background: 'none', border: '1px solid #4B5740', color: '#4B5740', padding: '13px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
            Recomeçar
          </button>
          <button
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '13px 24px', borderRadius: 2, fontSize: 13, cursor: canAddToCart ? 'pointer' : 'default', opacity: canAddToCart ? 1 : 0.5 }}
          >
            Adicionar ao carrinho — R$ {total}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="builder-grid" style={{ display: 'grid', gridTemplateColumns: '250px 1fr 300px', gap: 24, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#FFFFFF', borderRadius: 2, padding: 16, boxShadow: '0 1px 4px rgba(75,87,64,0.08)' }}>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, color: '#4B5740', margin: '0 0 6px' }}>Flores disponíveis</h3>
        {flowers.map((f) => (
          <div
            key={f.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/flower', f.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 2, cursor: 'grab', border: '1px solid rgba(75,87,64,0.1)' }}
          >
            <FlowerSvg visual={getFlowerVisual(f.id)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: '#4B5740' }}>{f.name}</div>
              <div style={{ fontSize: 11, color: '#8A8D7C' }}>R$ {f.price} / unid.</div>
            </div>
            <button
              onClick={() => addFlower(f.id)}
              style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #4B5740', background: '#FAF7F2', color: '#4B5740', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
            >
              +
            </button>
          </div>
        ))}
      </div>

      <div
        ref={canvasRef}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{ position: 'relative', background: '#EFE6D8', borderRadius: 4, height: 460, overflow: 'hidden', touchAction: 'none' }}
      >
        <div style={{ position: 'absolute', left: '50%', bottom: 110, width: 2, height: 2 }}>
          {layout.map((p) => (
            <div
              key={p.seed}
              onPointerDown={(e) => startDrag(e, p)}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${p.scale}) translate(-32px, -32px)`,
                zIndex: p.zIndex,
                cursor: 'grab',
              }}
            >
              <FlowerSvg visual={getFlowerVisual(p.flowerId)} size={70} />
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 0,
            transform: 'translateX(-50%)',
            width: 170,
            height: 90,
            background: 'linear-gradient(180deg,#C9AE8C,#9C7B54)',
            clipPath: 'polygon(18% 0,82% 0,100% 100%,0% 100%)',
            zIndex: 500,
          }}
        />
        {!hasFlowers && (
          <p style={{ position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', fontSize: 12.5, color: '#A7AB97', pointerEvents: 'none' }}>
            Arraste as flores para o vaso, ou toque no &quot;+&quot;
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: '#FFFFFF', borderRadius: 2, padding: 20, boxShadow: '0 1px 4px rgba(75,87,64,0.08)', position: 'sticky', top: 90 }}>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: '#4B5740', margin: 0 }}>Seu buquê</h3>
        {hasFlowers && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto' }}>
            {chosen.map((c) => {
              const f = flowerById(c.flowerId)!;
              return (
                <div key={c.flowerId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12.5, color: '#4B5740' }}>
                  <span style={{ flex: 1 }}>{f.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StepperButton onClick={() => removeFlower(c.flowerId)} label={`Remover uma unidade de ${f.name}`} kind="minus" />
                    <span>{c.qty}</span>
                    <StepperButton onClick={() => addFlower(c.flowerId)} label={`Adicionar uma unidade de ${f.name}`} kind="plus" />
                  </div>
                  <span style={{ width: 48, textAlign: 'right' }}>R$ {c.qty * f.price}</span>
                </div>
              );
            })}
          </div>
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 180))}
          maxLength={180}
          placeholder="Mensagem para o cartão…"
          style={{ width: '100%', minHeight: 64, padding: 10, border: '1px solid #D8CFC0', borderRadius: 2, fontFamily: "'Work Sans'", fontSize: 13, resize: 'vertical' }}
        />
        <p style={{ fontSize: 11, color: '#A7AB97', margin: '4px 0 0', textAlign: 'right' }}>{message.length}/180</p>
        {generateError && <p style={{ fontSize: 12, color: '#C4836A', margin: 0 }}>{generateError}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(75,87,64,0.12)', paddingTop: 12 }}>
          <span style={{ fontSize: 13, color: '#7C7F6D' }}>Total</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, color: '#4B5740' }}>R$ {total}</span>
        </div>
        {belowMinimum && (
          <p style={{ fontSize: 12, color: '#C4836A', margin: 0 }}>
            Valor mínimo do buquê: R$ {BUILDER_MIN_TOTAL} — faltam R$ {(BUILDER_MIN_TOTAL - total).toFixed(2)} em flores.
          </p>
        )}
        {aiEnabled && (
          <button
            onClick={handleGenerateIllustration}
            disabled={!hasFlowers}
            style={{ background: '#C4836A', color: '#FAF7F2', border: 'none', padding: 13, borderRadius: 2, fontSize: 13, cursor: 'pointer', opacity: hasFlowers ? 1 : 0.5 }}
          >
            Gerar minha ilustração
          </button>
        )}
        <button
          onClick={handleAddToCart}
          disabled={!canAddToCart}
          style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: 13, borderRadius: 2, fontSize: 13, cursor: canAddToCart ? 'pointer' : 'default', opacity: canAddToCart ? 1 : 0.5 }}
        >
          Adicionar ao carrinho
        </button>
      </div>
    </div>
  );
}

/**
 * Quantity +/- control drawn as SVG lines instead of the "−"/"+"
 * characters previously used as plain text. The minus sign in particular
 * (U+2212, a proper typographic minus, not a hyphen) was reported as not
 * rendering at all in production — plausibly a font/glyph-coverage gap in
 * whatever font actually got applied there. An SVG has no font
 * dependency, so it can't have that problem regardless of browser/OS/font
 * fallback.
 */
function StepperButton({ onClick, label, kind }: { onClick: () => void; label: string; kind: 'plus' | 'minus' }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: '1px solid #9CA08C',
        background: '#FFFFFF',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <line x1="1" y1="5" x2="9" y2="5" stroke="#4B5740" strokeWidth="1.6" strokeLinecap="round" />
        {kind === 'plus' && <line x1="5" y1="1" x2="5" y2="9" stroke="#4B5740" strokeWidth="1.6" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
