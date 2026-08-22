/**
 * Client-side "Sign in with Google" via Google Identity Services (GIS),
 * used instead of Supabase's redirect-based signInWithOAuth.
 *
 * Why: signInWithOAuth bounces the browser through
 * https://<project-ref>.supabase.co/auth/v1/callback, so that's the
 * domain Google's own consent screen shows ("Sign in to
 * kpscvlajdbkcnknjeeag.supabase.co") -- fixing that properly requires
 * Supabase's paid Custom Domains add-on. GIS runs entirely on our own
 * page instead: Google issues an ID token to floreatelie.com.br directly,
 * which we then hand to supabase.auth.signInWithIdToken() to create the
 * session -- no redirect through Supabase's domain at all, so nothing
 * ever shows their domain to the customer. Free, but it's real
 * engineering, not a config toggle -- see AuthGate.tsx.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            nonce?: string;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

/**
 * Generates the nonce pair Google Identity Services + Supabase's
 * signInWithIdToken require: Google's script needs the SHA-256-hashed
 * value up front (it embeds that hash in the ID token's own `nonce`
 * claim), while Supabase needs the original raw value afterward, to
 * verify that hash itself matches. A fresh pair per sign-in attempt.
 */
export async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = crypto.randomUUID();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hashed };
}
