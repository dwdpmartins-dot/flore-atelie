'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PasswordInput from './PasswordInput';

export default function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // The Supabase browser client is created with detectSessionInUrl on
      // by default, so it ALREADY exchanges this link's ?code= for a
      // session on its own, the moment it's constructed above. We used to
      // also call exchangeCodeForSession(code) ourselves right here, which
      // raced the SDK's own exchange for the exact same single-use code —
      // one of the two always lost and failed, which is why this screen
      // reliably failed on every attempt (not an expired-link fluke).
      // getSession() waits for that automatic exchange to finish before
      // resolving, so checking it is enough — no manual exchange needed.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
      } else {
        setLinkInvalid(true);
      }
    })();
  }, []);

  async function submit() {
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError('Não foi possível redefinir a senha. Solicite um novo link.');
      return;
    }
    setDone(true);
    setTimeout(() => router.replace('/minha-conta'), 1500);
  }

  if (linkInvalid) {
    return (
      <p style={{ fontSize: 13.5, color: '#7C7F6D', textAlign: 'center' }}>
        Este link de redefinição não é mais válido. Volte a &quot;Esqueci minha senha&quot; em Minha Conta e
        solicite um novo.
      </p>
    );
  }

  if (!ready) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontStyle: 'italic', color: '#4B5740', margin: '0 0 6px' }}>
        Nova senha
      </h1>
      {done ? (
        <p style={{ fontSize: 13.5, color: '#5C5F51' }}>Senha atualizada. Redirecionando…</p>
      ) : (
        <>
          <PasswordInput
            style={{ padding: 14, border: '1px solid #D8CFC0', borderRadius: 2, fontSize: 14 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha"
          />
          {error && <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0 }}>{error}</p>}
          <button
            onClick={submit}
            style={{ background: '#4B5740', color: '#FAF7F2', border: 'none', padding: 14, borderRadius: 2, fontSize: 14, cursor: 'pointer' }}
          >
            Salvar nova senha
          </button>
        </>
      )}
    </div>
  );
}
