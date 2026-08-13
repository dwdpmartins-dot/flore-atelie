'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/minha-conta');
    router.refresh();
  }

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
