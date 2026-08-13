import type { FlowerVisualResolved } from '@/lib/builder/flowerVisuals';

export default function FlowerSvg({ visual, size = 40 }: { visual: FlowerVisualResolved; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink: 0, overflow: 'visible' }}>
      {visual.petalsSvg.map((p, i) => (
        <ellipse
          key={i}
          cx={p.cx}
          cy={p.cy}
          rx={p.rx}
          ry={p.ry}
          transform={p.transform}
          fill={visual.petalColor}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={0.5}
        />
      ))}
      <circle cx={32} cy={32} r={visual.centerR} fill={visual.centerColor} />
    </svg>
  );
}
