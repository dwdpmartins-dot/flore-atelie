'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InlineAddressForm from '@/components/address/InlineAddressForm';
import type { Database } from '@/lib/supabase/types';

type Address = Database['public']['Tables']['addresses']['Row'];

export default function EnderecosTab({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {addresses.map((a) => (
        <div key={a.id} style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: 2, boxShadow: '0 1px 3px rgba(75,87,64,0.06)' }}>
          <div style={{ fontSize: 13, color: '#4B5740', fontWeight: 500 }}>
            {a.label} {a.preferred && <span style={{ fontSize: 10.5, color: '#8FA080' }}>· principal</span>}
          </div>
          <div style={{ fontSize: 12.5, color: '#8A8D7C' }}>
            {a.street}, {a.number}
            {a.complement ? ` — ${a.complement}` : ''} · {a.neighborhood} · {a.city}/{a.state} · CEP {a.cep}
          </div>
        </div>
      ))}

      <button onClick={() => setShowForm((v) => !v)} style={{ background: 'none', border: 'none', color: '#C4836A', fontSize: 13, cursor: 'pointer', padding: 0, textAlign: 'left' }}>
        {showForm ? 'Cancelar' : '+ Adicionar endereço'}
      </button>

      {showForm && (
        <InlineAddressForm
          onSaved={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
