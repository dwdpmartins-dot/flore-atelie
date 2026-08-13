'use client';

import { useSignOut } from '@/lib/auth/useSignOut';

export default function SignOutButton() {
  const signOut = useSignOut();

  return (
    <button
      onClick={signOut}
      style={{
        background: 'none',
        border: '1px solid #D8CFC0',
        color: '#7C7F6D',
        padding: '8px 16px',
        borderRadius: '2px',
        fontSize: '12px',
        cursor: 'pointer',
      }}
    >
      Sair
    </button>
  );
}
