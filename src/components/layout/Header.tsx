'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart/CartContext';
import { useSignOut } from '@/lib/auth/useSignOut';
import { createClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/assinatura', label: 'Assinatura' },
  { href: '/monte-seu-buque', label: 'Monte seu Buquê' },
];

function getInitial(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || '?';
  return source.charAt(0).toUpperCase();
}

interface AuthState {
  loaded: boolean;
  isLoggedIn: boolean;
  customerName: string | null;
  email: string | null;
}

export default function Header() {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const signOut = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Fetched client-side (rather than passed down from the root layout via
  // cookies()) so pages with no other reason to be dynamic — the privacy
  // policy, terms, 404 — stay statically rendered. The trade-off is a brief
  // moment with nothing shown in the auth slot on first paint (see `loaded`
  // below) instead of a server-rendered value; the auth state itself is
  // never wrong, since the section stays blank until this actually resolves.
  const [auth, setAuth] = useState<AuthState>({ loaded: false, isLoggedIn: false, customerName: null, email: null });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setAuth({ loaded: true, isLoggedIn: false, customerName: null, email: null });
        return;
      }
      const { data: customer } = await supabase.from('customers').select('name').eq('id', user.id).maybeSingle();
      if (!active) return;
      setAuth({ loaded: true, isLoggedIn: true, customerName: customer?.name ?? null, email: user.email ?? null });
    }

    loadAuth();

    // Login/logout/token-refresh anywhere in the app updates the header
    // immediately, without relying on every call site remembering to
    // trigger a refetch.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => loadAuth());

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accountMenuOpen]);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(250,247,242,0.94)',
        backdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(107,124,92,0.15)',
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <Image src="/assets/logo-flore.png" alt="Florê Ateliê" width={44} height={44} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, letterSpacing: 0.5, color: '#4B5740' }}>Florê Ateliê</span>
        </Link>

        <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{ fontSize: 14, color: pathname === link.href ? '#C4836A' : '#4B5740' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-social" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <a href="https://www.instagram.com/floreatelie.floral" target="_blank" rel="noreferrer" aria-label="Instagram" style={{ display: 'flex' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4B5740" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.2" cy="6.8" r="1" fill="#4B5740" stroke="none" />
            </svg>
          </a>
          <a
            href="https://wa.me/5511942364723?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20Flor%C3%AA%20Ateli%C3%AA%20e%20gostaria%20de%20saber%20mais."
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            style={{ display: 'flex' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#4B5740">
              <path d="M17.6 6.32A8.9 8.9 0 0 0 12.05 3.5C7.34 3.5 3.5 7.34 3.5 12.05c0 1.6.44 3.1 1.2 4.4L3.5 20.5l4.15-1.09a8.5 8.5 0 0 0 4.4 1.2h.01c4.71 0 8.55-3.84 8.55-8.55a8.5 8.5 0 0 0-2.51-6.24zM12.05 19a7.5 7.5 0 0 1-3.83-1.05l-.27-.16-2.85.75.76-2.78-.18-.28a7.44 7.44 0 0 1-1.14-3.98c0-4.13 3.36-7.49 7.5-7.49a7.44 7.44 0 0 1 5.3 2.2 7.44 7.44 0 0 1 2.19 5.3c0 4.13-3.36 7.49-7.48 7.49z" />
            </svg>
          </a>
          <a href="https://www.tiktok.com/@flore.ateliee" target="_blank" rel="noreferrer" aria-label="TikTok" style={{ display: 'flex' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#4B5740">
              <path d="M16.5 3c.3 2 1.7 3.6 3.7 3.9v2.5c-1.4 0-2.7-.4-3.7-1.1v6.4c0 3-2.4 5.3-5.3 5.3S6 17.7 6 14.7s2.4-5.3 5.3-5.3c.4 0 .8 0 1.1.1v2.6c-.3-.1-.7-.2-1.1-.2-1.5 0-2.7 1.2-2.7 2.8s1.2 2.8 2.7 2.8 2.8-1.2 2.8-2.8V3h2.4z" />
            </svg>
          </a>
        </div>

        {/* Auth indicator: always visible on desktop so the customer never
            has to click into Minha Conta just to check whether they're
            signed in. Collapses into the mobile hamburger menu below
            860px, alongside the rest of the nav. */}
        <div className="header-auth" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 34 }}>
          {!auth.loaded ? null : auth.isLoggedIn ? (
            <div ref={accountMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setAccountMenuOpen((v) => !v)}
                aria-label="Minha conta"
                aria-expanded={accountMenuOpen}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#C4836A',
                  color: '#FAF7F2',
                  border: 'none',
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {getInitial(auth.customerName, auth.email)}
              </button>
              {accountMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    background: '#FAF7F2',
                    border: '1px solid #D8CFC0',
                    borderRadius: 2,
                    boxShadow: '0 4px 16px rgba(75,87,64,0.14)',
                    minWidth: 170,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 6,
                    zIndex: 50,
                  }}
                >
                  <Link
                    href="/minha-conta"
                    onClick={() => setAccountMenuOpen(false)}
                    style={{ padding: '10px 12px', fontSize: 13.5, color: '#4B5740', borderRadius: 2 }}
                  >
                    Minha Conta
                  </Link>
                  <button
                    onClick={() => {
                      setAccountMenuOpen(false);
                      signOut();
                    }}
                    style={{ padding: '10px 12px', fontSize: 13.5, color: '#C4836A', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', borderRadius: 2 }}
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href={`/minha-conta?redirect=${encodeURIComponent(pathname)}`} style={{ fontSize: 13.5, color: '#4B5740' }}>
                Entrar
              </Link>
              <Link
                href={`/minha-conta?view=signup&redirect=${encodeURIComponent(pathname)}`}
                style={{ background: '#C4836A', color: '#FAF7F2', padding: '9px 16px', borderRadius: 2, fontSize: 13.5 }}
              >
                Cadastrar
              </Link>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Link href="/checkout" style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }} aria-label="Carrinho">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4B5740" strokeWidth="1.6">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {cartCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: '#C4836A',
                  color: '#FAF7F2',
                  fontSize: 10,
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {cartCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="mobile-menu-btn"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4B5740" strokeWidth="1.6">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav style={{ display: 'flex', flexDirection: 'column', padding: '8px 28px 20px', gap: 14, borderTop: '1px solid rgba(107,124,92,0.15)' }}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{ fontSize: 14, color: '#4B5740' }}>
              {link.label}
            </Link>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid rgba(107,124,92,0.1)', minHeight: 26 }}>
            {!auth.loaded ? null : auth.isLoggedIn ? (
              <>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: '#C4836A',
                    color: '#FAF7F2',
                    fontFamily: "'Playfair Display',serif",
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getInitial(auth.customerName, auth.email)}
                </div>
                <Link href="/minha-conta" onClick={() => setMenuOpen(false)} style={{ fontSize: 14, color: '#4B5740' }}>
                  Minha Conta
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  style={{ fontSize: 14, color: '#C4836A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link href={`/minha-conta?redirect=${encodeURIComponent(pathname)}`} onClick={() => setMenuOpen(false)} style={{ fontSize: 14, color: '#4B5740' }}>
                  Entrar
                </Link>
                <Link
                  href={`/minha-conta?view=signup&redirect=${encodeURIComponent(pathname)}`}
                  onClick={() => setMenuOpen(false)}
                  style={{ background: '#C4836A', color: '#FAF7F2', padding: '8px 16px', borderRadius: 2, fontSize: 13, marginLeft: 'auto' }}
                >
                  Cadastrar
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
