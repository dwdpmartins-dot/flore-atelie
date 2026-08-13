'use client';

import { useState } from 'react';
import { updateProfile } from '@/app/minha-conta/actions';
import type { Database } from '@/lib/supabase/types';

type Customer = Database['public']['Tables']['customers']['Row'];

const inputStyle: React.CSSProperties = { width: '100%', padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5 };
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#7C7F6D', display: 'block', marginBottom: 6 };

export default function DadosTab({ customer, email }: { customer: Customer | null; email: string | null }) {
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={async (formData) => {
        await updateProfile(formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}
    >
      <div>
        <label style={labelStyle}>Nome completo</label>
        <input name="name" defaultValue={customer?.name ?? ''} maxLength={60} placeholder="Nome completo" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Apelido</label>
        <input name="nickname" defaultValue={customer?.nickname ?? ''} maxLength={30} placeholder="Como prefere ser chamada(o)" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>WhatsApp / celular</label>
        <input name="phone" defaultValue={customer?.phone ?? ''} maxLength={15} inputMode="numeric" placeholder="(11) 90000-0000" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>E-mail</label>
        <input value={email ?? ''} disabled style={{ ...inputStyle, background: '#F3EDE3', color: '#8A8D7C' }} />
      </div>
      <button type="submit" style={{ alignSelf: 'flex-start', background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '11px 22px', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
        {saved ? 'Salvo ✓' : 'Salvar alterações'}
      </button>
      <p style={{ fontSize: 11.5, color: '#A7AB97', margin: 0 }}>Preenchidos aqui, esses dados já vêm prontos no checkout.</p>
    </form>
  );
}
