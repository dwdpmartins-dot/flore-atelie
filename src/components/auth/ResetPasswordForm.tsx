'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PasswordInput from './PasswordInput';

/**
 * Reads token_hash/type from the URL (see the "Reset Password" email
 * template change in supabase/README.md — the link points here instead of
 * straight at Supabase's own /auth/v1/verify endpoint) but deliberately
 * does NOT call verifyOtp on page load. That single-use token is only ever
 * presented to Supabase inside submit(), in direct response to the
 * "Salvar nova senha" click.
 *
 * This matters because email providers routinely prefetch/scan links in
 * the background before a person ever clicks them. A GET straight to
 * Supabase's verify endpoint (the old {{ .ConfirmationURL }} link) burns
 * the token the instant that scan happens, so the real click always found
 * it already used (otp_expired) — confirmed via the redirect landing with
 * error=access_denied&error_code=otp_expired and no visible network call
 * at click time. Landing on our own page first, where nothing consumes the
 * token until an explicit click, is Supabase's documented mitigation for
 * this.
 */
export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash');
  const linkAlreadyInvalid = !tokenHash || Boolean(searchParams.get('error'));

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!tokenHash) return;
    setError('');
    setLoading(true);
    const supabase = createClient();

    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (verifyError) {
      setLoading(false);
      setError('Este link não é mais válido. Volte a "Esqueci minha senha" em Minha Conta e solicite um novo.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError('Não foi possível redefinir a senha. Tente novamente.');
      return;
    }
    setDone(true);
    setTimeout(() => router.replace('/minha-conta'), 1500);
  }

  if (linkAlreadyInvalid) {
    return (
      <p style={{ fontSize: 13.5, color: '#7C7F6D', textAlign: 'center' }}>
        Este link de redefinição não é mais válido. Volte a &quot;Esqueci minha senha&quot; em Minha Conta e
        solicite um novo.
      </p>
    );
  }

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
            disabled={loading}
            style={{
              background: '#4B5740',
              color: '#FAF7F2',
              border: 'none',
              padding: 14,
              borderRadius: 2,
              fontSize: 14,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </>
      )}
    </div>
  );
}
