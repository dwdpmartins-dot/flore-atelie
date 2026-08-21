'use client';

import { useState } from 'react';
import CardPaymentBrick from '@/components/payment/CardPaymentBrick';
import type { Database } from '@/lib/supabase/types';

type SavedCard = Database['public']['Tables']['saved_cards']['Row'];

export default function CartoesTab({ cards: initialCards, email }: { cards: SavedCard[]; email: string | null }) {
  const [cards, setCards] = useState(initialCards);
  const [showNewCard, setShowNewCard] = useState(false);
  const [formError, setFormError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [settingPreferredId, setSettingPreferredId] = useState<string | null>(null);

  async function removeCard(id: string) {
    setRemoveError('');
    setRemovingId(id);
    const res = await fetch(`/api/cards?id=${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setRemovingId(null);
    if (!res.ok) {
      setRemoveError(data.error || 'Não foi possível remover o cartão.');
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  async function setPreferred(id: string) {
    setRemoveError('');
    setSettingPreferredId(id);
    const res = await fetch('/api/cards', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setSettingPreferredId(null);
    if (!res.ok) {
      setRemoveError('Não foi possível definir o cartão padrão.');
      return;
    }
    setCards((prev) => prev.map((c) => ({ ...c, preferred: c.id === id })));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cards.length === 0 && <p style={{ fontSize: 13.5, color: '#7C7F6D' }}>Nenhum cartão salvo ainda.</p>}
      {cards.map((c) => (
        <div
          key={c.id}
          style={{
            padding: '16px 18px',
            background: '#FFFFFF',
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(75,87,64,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, color: '#4B5740' }}>
            {c.brand} •••• {c.last4} {c.preferred && <span style={{ fontSize: 10.5, color: '#8FA080' }}>· padrão</span>}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {!c.preferred && (
              <button
                onClick={() => setPreferred(c.id)}
                disabled={settingPreferredId === c.id}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7C7F6D',
                  fontSize: 12.5,
                  cursor: settingPreferredId === c.id ? 'default' : 'pointer',
                  opacity: settingPreferredId === c.id ? 0.6 : 1,
                  padding: 0,
                }}
              >
                {settingPreferredId === c.id ? 'Definindo…' : 'Definir como padrão'}
              </button>
            )}
            <button
              onClick={() => removeCard(c.id)}
              disabled={removingId === c.id}
              style={{
                background: 'none',
                border: 'none',
                color: '#C4836A',
                fontSize: 12.5,
                cursor: removingId === c.id ? 'default' : 'pointer',
                opacity: removingId === c.id ? 0.6 : 1,
                padding: 0,
              }}
            >
              {removingId === c.id ? 'Removendo…' : 'Remover'}
            </button>
          </div>
        </div>
      ))}

      {removeError && <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0 }}>{removeError}</p>}

      <button
        onClick={() => setShowNewCard((v) => !v)}
        style={{ background: 'none', border: 'none', color: '#C4836A', fontSize: 13, cursor: 'pointer', padding: 0, textAlign: 'left' }}
      >
        {showNewCard ? 'Cancelar' : '+ Adicionar cartão'}
      </button>

      {showNewCard && (
        <div style={{ marginTop: 4 }}>
          {/* Same Card Payment Brick used at checkout, but here there's no
              order/subscription in progress — it only ever saves the card.
              amount=1 is a nominal value the Brick needs to initialize (it's
              never charged); maxInstallments=1 hides the installment picker
              since nothing is being paid. */}
          <CardPaymentBrick
            amount={1}
            maxInstallments={1}
            payerEmail={email ?? undefined}
            notice={
              <>
                <strong>Nenhuma cobrança será feita agora.</strong> Este formulário apenas salva o cartão para uso
                futuro em compras e assinaturas.
              </>
            }
            onResult={async (result) => {
              setFormError('');
              const res = await fetch('/api/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: result.token }),
              });
              const data = await res.json().catch(() => ({}));
              if (data.card) {
                setCards((prev) => [...prev, data.card]);
                setShowNewCard(false);
              } else {
                setFormError(data.error || 'Não foi possível salvar o cartão agora.');
              }
            }}
            onError={setFormError}
          />
          {formError && <p style={{ fontSize: 12.5, color: '#C4836A', margin: '10px 0 0' }}>{formError}</p>}
        </div>
      )}

      <p style={{ fontSize: 12.5, color: '#7C7F6D', margin: '6px 0 0' }}>
        Cartões são salvos com segurança (nunca passam pelos nossos servidores — apenas um token do Mercado Pago é
        armazenado).
      </p>
    </div>
  );
}
