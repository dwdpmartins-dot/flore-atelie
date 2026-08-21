'use client';

import { useState } from 'react';
import { addAddress } from '@/app/minha-conta/actions';
import type { Database } from '@/lib/supabase/types';

type Address = Database['public']['Tables']['addresses']['Row'];

/** CEP-driven "add address" form, shared by Minha Conta, the subscription wizard, and checkout. */
export default function InlineAddressForm({ onSaved }: { onSaved: (addr: Address) => void }) {
  const [cep, setCep] = useState('');
  const [resolvedStreet, setResolvedStreet] = useState('');
  const [resolving, setResolving] = useState(false);
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCepChange(value: string) {
    setCep(value);
    setResolvedStreet('');
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/cep?cep=${digits}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || 'CEP não encontrado.');
        return;
      }
      const data = await res.json();
      setResolvedStreet(`${data.street}, ${data.neighborhood} — ${data.city}/${data.state}`);
      setError('');
    } finally {
      setResolving(false);
    }
  }

  async function save() {
    if (!number.trim()) {
      setError('Informe o número.');
      return;
    }
    setSaving(true);
    const formData = new FormData();
    formData.set('cep', cep);
    formData.set('number', number);
    formData.set('complement', complement);
    const result = await addAddress(formData);
    setSaving(false);
    if (result?.error || !result?.address) {
      setError(result?.error || 'Não foi possível salvar o endereço.');
      return;
    }
    onSaved(result.address);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#F3EDE3', borderRadius: 2 }}>
      <input value={cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="CEP (obrigatório)" style={{ padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5, maxWidth: 160 }} />
      <input
        value={resolving ? 'Consultando…' : resolvedStreet}
        disabled
        placeholder="Endereço (preenchido pelo CEP)"
        style={{ padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5, background: '#F3EDE3', color: '#4B5740' }}
      />
      {!resolvedStreet && !resolving && <p style={{ fontSize: 11.5, color: '#A7AB97', margin: 0 }}>Digite um CEP válido para liberar número e complemento.</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={number} onChange={(e) => setNumber(e.target.value)} disabled={!resolvedStreet} placeholder="Número" style={{ flex: 1, padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5 }} />
        <input value={complement} onChange={(e) => setComplement(e.target.value)} disabled={!resolvedStreet} placeholder="Complemento (opcional)" style={{ flex: 2, padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5 }} />
      </div>
      {error && <p style={{ fontSize: 12, color: '#C4836A', margin: 0 }}>{error}</p>}
      <button onClick={save} disabled={!resolvedStreet || saving} style={{ alignSelf: 'flex-start', background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '11px 20px', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
        Salvar endereço
      </button>
    </div>
  );
}
