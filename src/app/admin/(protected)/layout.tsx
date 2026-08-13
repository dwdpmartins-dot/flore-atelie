import { requireAdmin } from '@/lib/auth/session';

// Guards every /admin/* route except /admin/entrar (which lives outside
// this route group). Redirects to the admin login if the session isn't
// signed in AND present in admin_users.
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
