import { Suspense } from 'react';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export default function RedefinirSenhaPage() {
  return (
    <section style={{ maxWidth: 360, margin: '60px auto', padding: '0 28px 110px' }}>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </section>
  );
}
