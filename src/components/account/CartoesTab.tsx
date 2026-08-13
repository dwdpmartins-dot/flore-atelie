import Link from 'next/link';
import type { Database } from '@/lib/supabase/types';

type SavedCard = Database['public']['Tables']['saved_cards']['Row'];

export default function CartoesTab({ cards }: { cards: SavedCard[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cards.length === 0 && <p style={{ fontSize: 13.5, color: '#7C7F6D' }}>Nenhum cartão salvo ainda.</p>}
      {cards.map((c) => (
        <div key={c.id} style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: 2, boxShadow: '0 1px 3px rgba(75,87,64,0.06)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#4B5740' }}>
            {c.brand} •••• {c.last4}
          </span>
          <span style={{ fontSize: 12, color: '#8A8D7C' }}>tokenizado</span>
        </div>
      ))}
      <p style={{ fontSize: 12.5, color: '#7C7F6D', margin: '6px 0 0' }}>
        Cartões são adicionados com segurança direto no checkout (nunca passam pelos nossos servidores — apenas um
        token do Mercado Pago é salvo).{' '}
        <Link href="/checkout" style={{ color: '#C4836A' }}>
          Ir para o checkout
        </Link>
        .
      </p>
    </div>
  );
}
