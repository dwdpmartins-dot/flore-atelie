import 'server-only';

/**
 * Shared HTML wrapper for every transactional email. Deliberately
 * text-forward with almost no imagery: a new sending domain (ours just got
 * verified on Resend) is judged harshly by spam filters in its first weeks,
 * and a heavy, image/color-saturated "marketing" look is exactly the
 * pattern that gets flagged — a plain, mostly-text layout with restrained
 * brand color reads as a real transactional receipt instead.
 *
 * Table-based layout with every style inlined: email clients strip <style>
 * blocks and don't share a CSS box model, so this is deliberately not
 * written like a web page.
 */
const INK = '#4B5740'; // verde-musgo — body text, headings
const MUTED = '#7C7F6D';
const ACCENT = '#C4836A'; // terracota — used once, sparingly (eyebrow label)
const BORDER = '#E4DCCB';
const BG = '#FAF7F2';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface EmailShellOptions {
  /** Small uppercase label above the heading, e.g. "PEDIDO CONFIRMADO". */
  eyebrow: string;
  /** Main heading — plain text, escaped (this isn't a template for markup). */
  heading: string;
  /** Already-safe HTML for the body — templates.ts builds this from escaped pieces. */
  bodyHtml: string;
  /** Preview text shown in the inbox list before the email is opened. */
  preheader: string;
}

export function renderEmailShell({ eyebrow, heading, bodyHtml, preheader }: EmailShellOptions): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0; padding:0; background:${BG}; font-family: Georgia, 'Times New Roman', serif;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
<tr><td align="center" style="padding: 32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr>
    <td style="padding-bottom: 22px;">
      <span style="font-family: Georgia, serif; font-size: 15px; font-weight: bold; color: ${INK}; letter-spacing: 0.5px;">Florê Ateliê</span>
    </td>
  </tr>
  <tr>
    <td style="background:#FFFFFF; border:1px solid ${BORDER}; border-radius:4px; padding: 34px 30px;">
      <span style="font-family: Helvetica, Arial, sans-serif; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${ACCENT};">${escapeHtml(eyebrow)}</span>
      <h1 style="font-family: Georgia, serif; font-style: italic; font-size: 22px; color: ${INK}; margin: 10px 0 18px; font-weight: normal;">${escapeHtml(heading)}</h1>
      <div style="font-family: Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.65; color: #3F4438;">
        ${bodyHtml}
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding: 20px 6px 0;">
      <p style="font-family: Helvetica, Arial, sans-serif; font-size: 11.5px; color: ${MUTED}; line-height: 1.6; margin: 0;">
        Florê Ateliê · Dúvidas? Responda este e-mail — ele chega direto em
        <a href="mailto:contato@floreatelie.com.br" style="color: ${MUTED};">contato@floreatelie.com.br</a>.<br />
        <a href="https://floreatelie.com.br" style="color: ${MUTED};">floreatelie.com.br</a>
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Simple <p> paragraph — the most common body block. Escapes its text. */
export function p(text: string): string {
  return `<p style="margin: 0 0 14px;">${escapeHtml(text)}</p>`;
}

/** A label/value row inside a summary block (e.g. "Valor" / "R$ 79,00"). */
export function row(label: string, value: string): string {
  return `<tr>
    <td style="padding: 7px 0; font-size: 13.5px; color: ${MUTED};">${escapeHtml(label)}</td>
    <td style="padding: 7px 0; font-size: 13.5px; color: ${INK}; text-align:right; font-weight: bold;">${escapeHtml(value)}</td>
  </tr>`;
}

/** Wraps a set of row()s in a bordered summary table. */
export function summaryBlock(rowsHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}; border-radius:4px; padding: 4px 16px; margin: 4px 0 18px;">
    ${rowsHtml}
  </table>`;
}

export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 4px;"><tr><td style="background:${INK}; border-radius:2px;">
    <a href="${href}" style="display:inline-block; padding: 12px 24px; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #FAF7F2; text-decoration: none;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

export { escapeHtml };
