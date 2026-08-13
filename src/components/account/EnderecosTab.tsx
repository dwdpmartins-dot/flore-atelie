'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addAddress } from '@/app/minha-conta/actions';
import type { Database } from '@/lib/supabase/types';

type Address = Database['public']['Tables']['addresses']['Row'];

export default function EnderecosTab({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [cep, setCep] = useState('');
  const [resolvedStreet, setResolvedStreet] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fieldsDisabled = resolvedStreet === '';

  async function handleCepChange(value: string) {
    setCep(value);
    setResolvedStreet('');
    setError('');
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/cep?cep=${digits}`);
      if (!res.ok) {
        setError('CEP não encontrado.');
        return;
      }
      const data = await res.json();
      setResolvedStreet(`${data.street}, ${data.neighborhood} — ${data.city}/${data.state}`);
    } catch {
      setError('Não foi possível consultar o CEP agora.');
    } finally {
      setResolving(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    const result = await addAddress(formData);
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    setCep('');
    setResolvedStreet('');
    router.refresh();
  }

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
        <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#F3EDE3', borderRadius: 2 }}>
          <input
            name="cep"
            value={cep}
            onChange={(e) => handleCepChange(e.target.value)}
            placeholder="CEP (obrigatório)"
            style={{ padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5, maxWidth: 160 }}
          />
          <input
            value={resolving ? 'Consultando…' : resolvedStreet}
            disabled
            placeholder="Endereço (preenchido pelo CEP)"
            style={{ padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5, background: '#F3EDE3', color: '#4B5740' }}
          />
          {fieldsDisabled && !resolving && (
            <p style={{ fontSize: 11.5, color: '#A7AB97', margin: 0 }}>Digite um CEP válido para liberar número e complemento.</p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <input name="number" disabled={fieldsDisabled} placeholder="Número" style={{ flex: 1, padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5 }} />
            <input name="complement" disabled={fieldsDisabled} placeholder="Complemento (opcional)" style={{ flex: 2, padding: 12, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 13.5 }} />
          </div>
          {error && <p style={{ fontSize: 12, color: '#C4836A', margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={fieldsDisabled || submitting}
            style={{ alignSelf: 'flex-start', background: '#4B5740', color: '#FAF7F2', border: 'none', padding: '11px 20px', borderRadius: 2, fontSize: 13, cursor: 'pointer', opacity: fieldsDisabled ? 0.5 : 1 }}
          >
            Salvar endereço
          </button>
        </form>
      )}
    </div>
  );
}
