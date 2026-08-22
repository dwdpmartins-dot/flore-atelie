'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { sendWelcomeEmailForCurrentUser } from '@/app/auth/actions';
import { generateNonce } from '@/lib/auth/googleIdentity';
import PasswordInput from './PasswordInput';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

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
/**
 * The logged-out state of Minha Conta: login / signup / forgot-password,
 * as one screen the user toggles between — same structure as the prototype,
 * now backed by real Supabase Auth instead of simulated state.
 */
export default function AuthGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Home, not Minha Conta -- only redirect there when the caller explicitly
  // asked for it (e.g. the header's "Entrar" link sets redirect to
  // wherever the customer already was). Logging in without an explicit
  // destination should land on the site's front door, not assume Minha
  // Conta is what anyone actually wants.
  const redirectTo = searchParams.get('redirect') || '/';
  const initialView = searchParams.get('view') === 'signup' ? 'signup' : 'login';

  const [view, setView] = useState<View>(initialView);
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

  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleNonceRef = useRef('');

  async function handleGoogleCredential(response: { credential: string }) {
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.credential,
      nonce: googleNonceRef.current,
    });
    setLoading(false);
    if (error) {
      setError('Não foi possível entrar com o Google. Tente novamente.');
      return;
    }
    if (data.session) {
      void sendWelcomeEmailForCurrentUser();
    }
    router.replace(redirectTo);
    router.refresh();
  }

  // Renders Google's own "Sign in with Google" button into googleButtonRef
  // once its script has loaded -- re-runs whenever the login view mounts
  // again (view flips back to 'login'), since switching away unmounts the
  // container div and an already-loaded script's onLoad won't fire a
  // second time to trigger this on its own. A fresh nonce is generated
  // each time, so every render of the button carries its own.
  useEffect(() => {
    if (!googleScriptReady || view !== 'login' || !GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    generateNonce().then(({ raw, hashed }) => {
      if (cancelled || !window.google || !googleButtonRef.current) return;
      googleNonceRef.current = raw;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        nonce: hashed,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320,
        locale: 'pt-BR',
      });
    });
    return () => {
      cancelled = true;
    };
    // handleGoogleCredential intentionally excluded -- it's recreated every
    // render but reads googleNonceRef.current fresh at call time, so an
    // older closure is never stale in a way that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleScriptReady, view]);

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
      // Fire-and-forget: this is a self-contained request to a Server
      // Action (its own request/response cycle, not tied to whether we
      // await it here), so not blocking navigation on it is safe -- the
      // welcome email shouldn't add latency to signup.
      void sendWelcomeEmailForCurrentUser();
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
        <PasswordInput
          style={inputStyle}
          value={signupPassword}
          onChange={(e) => setSignupPassword(e.target.value)}
          placeholder="Senha"
        />
        <PasswordInput
          style={inputStyle}
          value={signupPasswordConfirm}
          onChange={(e) => setSignupPasswordConfirm(e.target.value)}
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
      {GOOGLE_CLIENT_ID && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleScriptReady(true)} />}
      <div style={{ maxWidth: 360, margin: '60px auto', display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontStyle: 'italic', color: '#4B5740', margin: '0 0 6px' }}>
          Entrar na sua conta
        </h1>
        <input style={inputStyle} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="seu@email.com" />
        <PasswordInput
          style={inputStyle}
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          placeholder="Senha"
        />
        {error && <p style={{ fontSize: 12.5, color: '#C4836A', margin: 0 }}>{error}</p>}
        <button style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }} onClick={doLogin} disabled={loading}>
          Entrar com e-mail
        </button>
        {/* Google's own rendered button -- required to stay compliant with
            their branding guidelines for Identity Services; it won't match
            our custom button style pixel for pixel, but it's what lets this
            skip the ugly "Sign in to <supabase-project>.supabase.co" screen
            (see lib/auth/googleIdentity.ts) for free. */}
        <div ref={googleButtonRef} style={{ display: 'flex', justifyContent: 'center' }} />
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
