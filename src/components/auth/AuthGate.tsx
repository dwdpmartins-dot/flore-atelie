'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type View = 'login' | 'signup' | 'forgot';

const inputStyle: React.CSSProperties = {
  padding: '14px',
  border: '1px solid #D8CFC0',
  borderRadius: '2px',
  fontSize: '14px',
  width: '100%',
};
const primaryBtn: React.CSSProperties = {
  background: '#4B5740',
  color: '#FAF7F2',
  border: 'none',
  padding: '14px',
  borderRadius: '2px',
  fontSize: '14px',
  cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  background: '#FFFFFF',
  color: '#4B5740',
  border: '1px solid #D8CFC0',
  padding: '14px',
  borderRadius: '2px',
  fontSize: '14px',
  cursor: 'pointer',
};

/**
 * The logged-out state of Minha Conta: login / signup / forgot-password,
 * as one screen the user toggles between — same structure as the prototype,
 * now backed by real Supabase Auth instead of simulated state.
 */
export default function AuthGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/minha-conta';

  const [view, setView] = useState<View>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupExistsError, setSignupExistsError] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  async function doLogin() {
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoading(false);
    if (error) {
      setError('E-mail ou senha inválidos.');
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  async function doGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}` },
    });
  }

  async function doSignup() {
    setError('');
    setSignupExistsError(false);

    if (signupPassword !== signupPasswordConfirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: { data: { name: signupName, phone: signupPhone } },
    });
    setLoading(false);
    if (error) {
      if (/already|existe/i.test(error.message)) {
        setSignupExistsError(true);
      } else {
        setError(error.message);
      }
      return;
    }
    // If e-mail confirmation is disabled on the project (as it should be,
    // per the "sem verificação de e-mail" rule), signUp returns a session
    // immediately and the person is already logged in.
    if (data.session) {
      router.replace(redirectTo);
      router.refresh();
    } else {
      setView('login');
    }
  }

  async function doForgotPassword() {
    setError('');
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    setForgotSent(true);
  }

  if (view === 'signup') {
    return (
      <div style={{ maxWidth: 360, margin: '60px auto', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontStyle: 'italic', color: '#4B5740', margin: '0 0 6px' }}>
          Criar sua conta
        </h1>
        <input style={inputStyle} value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="Nome completo" />
        <input style={inputStyle} value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} placeholder="seu@email.com" />
        <input
          style={inputStyle}
          value={signupPhone}
          onChange={(e) => setSignupPhone(e.target.value)}
          maxLength={15}
          placeholder="WhatsApp / celular"
        />
        <input
          style={inputStyle}
          value={signupPassword}
          onChange={(e) => setSignupPassword(e.target.value)}
          type="password"
          placeholder="Senha"
        />
        <input
          style={inputStyle}
          value={signupPasswordConfirm}
          onChange={(e) => setSignupPasswordConfirm(e.target.value)}
          type="password"
          placeholder="Confirmar senha"
        />
        {signupExistsError && (
          <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0, textAlign: 'left' }}>
            Já existe uma conta com esse e-mail.{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); setView('login'); }}>
              Entrar
            </a>{' '}
            ou{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); setView('forgot'); }}>
              recuperar senha
            </a>
            .
          </p>
        )}
        {error && <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0 }}>{error}</p>}
        <button style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }} onClick={doSignup} disabled={loading}>
          Criar conta
        </button>
        <a href="#" onClick={(e) => { e.preventDefault(); setView('login'); }} style={{ fontSize: 12.5 }}>
          Já tenho conta
        </a>
      </div>
    );
  }

  if (view === 'forgot') {
    return (
      <div style={{ maxWidth: 360, margin: '60px auto', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontStyle: 'italic', color: '#4B5740', margin: '0 0 6px' }}>
          Recuperar senha
        </h1>
        {forgotSent ? (
          <p style={{ fontSize: 13.5, color: '#5C5F51' }}>
            Se {forgotEmail} estiver cadastrado, você receberá um link para redefinir sua senha em instantes.
          </p>
        ) : (
          <>
            <input style={inputStyle} value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="seu@email.com" />
            <button style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }} onClick={doForgotPassword} disabled={loading}>
              Enviar link de redefinição
            </button>
          </>
        )}
        <a href="#" onClick={(e) => { e.preventDefault(); setView('login'); }} style={{ fontSize: 12.5 }}>
          Voltar ao login
        </a>
      </div>
    );
  }

  return (
    <>
      <div style={{ maxWidth: 360, margin: '60px auto', display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontStyle: 'italic', color: '#4B5740', margin: '0 0 6px' }}>
          Entrar na sua conta
        </h1>
        <input style={inputStyle} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="seu@email.com" />
        <input
          style={inputStyle}
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          type="password"
          placeholder="Senha"
        />
        {error && <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0 }}>{error}</p>}
        <button style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }} onClick={doLogin} disabled={loading}>
          Entrar com e-mail
        </button>
        <button style={secondaryBtn} onClick={doGoogleLogin}>
          Entrar com Google
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setView('signup'); }} style={{ fontSize: 12.5 }}>
            Criar conta
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setView('forgot'); }} style={{ fontSize: 12.5 }}>
            Esqueci minha senha
          </a>
        </div>
      </div>
      <p style={{ fontSize: 11, color: '#A7AB97', textAlign: 'center', marginTop: 14 }}>
        Senhas nunca ficam em texto puro: armazenamos apenas o hash, com varredura de segurança e criptografia de
        ponta a ponta para dados sensíveis e de pagamento.
      </p>
    </>
  );
}
