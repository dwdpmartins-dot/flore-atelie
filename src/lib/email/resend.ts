import 'server-only';

/**
 * Low-level Resend client — direct REST calls (same pattern as
 * mercadopago/server.ts's mpFetch) rather than the `resend` npm package, so
 * there's no new dependency for one endpoint.
 *
 * floreatelie.com.br is already verified on Resend (SPF/DKIM configured),
 * so every email sends from a real @floreatelie.com.br address instead of
 * Resend's shared sandbox domain.
 */
const RESEND_API_BASE = 'https://api.resend.com';
const FROM = 'Florê Ateliê <contato@floreatelie.com.br>';
const REPLY_TO = 'contato@floreatelie.com.br';

/**
 * Logs the real Resend error detail before a caller swallows it — same
 * reasoning as mercadopago/server.ts's logMpError: console.error truncates
 * nested objects, so JSON.stringify first keeps whatever Resend's API
 * actually said (invalid recipient, domain not verified, rate limit, etc.)
 * visible in the logs instead of printing as a bare "[Object]".
 */
export function logEmailError(context: string, err: unknown) {
  const detail = err instanceof Error ? { message: err.message, resendBody: (err as Error & { resendBody?: unknown }).resendBody } : err;
  console.error(context, JSON.stringify(detail, null, 2));
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Sends one email via the Resend API. Deliberately never throws — every
 * call site is a side effect of some other, already-succeeded business
 * event (an order got paid, a subscription was confirmed, a signup
 * completed), and a flaky email provider must never turn that into a
 * user-facing failure. Callers that need to track delivery (e.g. an
 * idempotency guard) should only act on a truthy return value.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string } | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('sendEmail: RESEND_API_KEY não configurado — email não enviado', { to: input.to, subject: input.subject });
    return null;
  }

  if (!input.to) {
    console.error('sendEmail: destinatário vazio — email não enviado', { subject: input.subject });
    return null;
  }

  try {
    const res = await fetch(`${RESEND_API_BASE}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        reply_to: [input.replyTo ?? REPLY_TO],
        subject: input.subject,
        html: input.html,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      const err = new Error(body?.message || 'Erro na Resend API');
      (err as Error & { resendBody?: unknown }).resendBody = body;
      throw err;
    }
    return body as { id: string };
  } catch (err) {
    logEmailError(`sendEmail failed (${input.subject} -> ${input.to})`, err);
    return null;
  }
}
