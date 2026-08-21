import 'server-only';
import { renderEmailShell, p, row, summaryBlock, button, escapeHtml } from './shell';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://floreatelie.com.br';

export function fmtBRL(n: number): string {
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

export function fmtDateBR(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const PERIOD_LABEL: Record<string, string> = { manha: 'Manhã (9h–12h)', tarde: 'Tarde (13h–18h)' };

export interface EmailPayload {
  subject: string;
  html: string;
}

// ───────────────────────── 1. Boas-vindas ─────────────────────────

export function welcomeEmail(opts: { name: string }): EmailPayload {
  const firstName = opts.name?.split(' ')[0] || '';
  return {
    subject: 'Bem-vinda à Florê Ateliê 🌿',
    html: renderEmailShell({
      eyebrow: 'Bem-vinda',
      heading: firstName ? `Que bom ter você aqui, ${firstName}.` : 'Que bom ter você aqui.',
      preheader: 'Sua conta na Florê Ateliê está pronta.',
      bodyHtml: [
        p('Sua conta foi criada com sucesso. Por aqui você pode:'),
        `<ul style="margin: 0 0 18px; padding-left: 20px;">
          <li style="margin-bottom: 8px;"><strong>Assinar</strong> — flores novas chegando no ritmo que você escolher.</li>
          <li style="margin-bottom: 8px;"><strong>Montar seu buquê</strong> — escolha cada flor e veja a composição se formar.</li>
          <li style="margin-bottom: 8px;"><strong>Comprar avulso</strong> — um buquê pronto ou inspirado da Florê, para hoje ou para presentear.</li>
        </ul>`,
        button('Ir para a Florê', SITE_URL),
      ].join(''),
    }),
  };
}

// ───────────────────── 2. Pedido avulso confirmado ─────────────────────

export interface OrderConfirmationItem {
  name: string;
  qty: number;
  unitPrice: number;
}

export function orderConfirmationEmail(opts: {
  orderId: string;
  items: OrderConfirmationItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  deliveryDate: string;
  deliveryPeriod: 'manha' | 'tarde' | null;
  address: { street: string; number: string; complement?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null };
}): EmailPayload {
  const itemsHtml = opts.items
    .map((i) => row(i.qty > 1 ? `${i.name} (×${i.qty})` : i.name, fmtBRL(i.unitPrice * i.qty)))
    .join('');
  const addr = opts.address;
  const addrLine = `${addr.street}, ${addr.number}${addr.complement ? ` — ${addr.complement}` : ''}`;
  const addrCity = [addr.neighborhood, addr.city && addr.state ? `${addr.city}/${addr.state}` : null].filter(Boolean).join(' · ');

  return {
    subject: `Pedido confirmado — Florê Ateliê (#${opts.orderId.slice(0, 8)})`,
    html: renderEmailShell({
      eyebrow: 'Pedido confirmado',
      heading: 'Seu pedido está a caminho de acontecer.',
      preheader: `Pagamento aprovado — entrega prevista em ${fmtDateBR(opts.deliveryDate)}.`,
      bodyHtml: [
        p(`Recebemos seu pagamento e já estamos preparando tudo. Pedido #${opts.orderId.slice(0, 8)}.`),
        summaryBlock(
          itemsHtml +
            row('Frete', fmtBRL(opts.shippingFee)) +
            row('Total', fmtBRL(opts.total))
        ),
        `<p style="margin: 0 0 6px; font-weight: bold; color:#4B5740;">Entrega</p>`,
        p(`${fmtDateBR(opts.deliveryDate)}${opts.deliveryPeriod ? ` — ${PERIOD_LABEL[opts.deliveryPeriod] ?? opts.deliveryPeriod}` : ''}`),
        p(`${addrLine}${addrCity ? ` · ${addrCity}` : ''}`),
      ].join(''),
    }),
  };
}

// ───────────────── 3. Assinatura confirmada (primeira cobrança) ─────────────────

export function subscriptionConfirmationEmail(opts: {
  freq: string;
  size: string;
  price: number;
  nextDeliveryDate: string;
}): EmailPayload {
  return {
    subject: 'Assinatura confirmada — Florê Ateliê 🌸',
    html: renderEmailShell({
      eyebrow: 'Assinatura confirmada',
      heading: 'Sua primeira cobrança foi aprovada.',
      preheader: `Plano ${opts.freq} · ${opts.size} — próxima entrega em ${fmtDateBR(opts.nextDeliveryDate)}.`,
      bodyHtml: [
        p('A partir de agora, flores novas chegam no ritmo que você escolheu.'),
        summaryBlock(
          row('Plano', `${opts.freq} · ${opts.size}`) +
            row('Valor por ciclo', fmtBRL(opts.price)) +
            row('Próxima entrega', fmtDateBR(opts.nextDeliveryDate))
        ),
        p(
          `Você pode pausar ou cancelar quando quiser, sem multa — pedidos feitos com pelo menos 2 dias úteis de antecedência da próxima entrega valem já para o ciclo seguinte.`
        ),
        button('Gerenciar assinatura', `${SITE_URL}/assinatura`),
      ].join(''),
    }),
  };
}

// ───────────────────── 4. Pagamento recusado ─────────────────────

export function paymentDeclinedEmail(opts: { kind: 'avulso' | 'assinatura' }): EmailPayload {
  const retryUrl = opts.kind === 'assinatura' ? `${SITE_URL}/assinatura` : `${SITE_URL}/checkout`;
  return {
    subject: 'Não conseguimos aprovar seu pagamento — Florê Ateliê',
    html: renderEmailShell({
      eyebrow: 'Pagamento não aprovado',
      heading: 'Seu pagamento não foi aprovado.',
      preheader: 'Tente novamente ou use outra forma de pagamento.',
      bodyHtml: [
        p(
          opts.kind === 'assinatura'
            ? 'A cobrança da sua assinatura não foi aprovada pela operadora do cartão. Isso pode acontecer por saldo/limite insuficiente ou uma recusa momentânea do banco.'
            : 'O pagamento do seu pedido não foi aprovado pela operadora do cartão. Isso pode acontecer por saldo/limite insuficiente ou uma recusa momentânea do banco.'
        ),
        p('Nenhum valor foi cobrado. Tente novamente ou use outro cartão / PIX.'),
        button('Tentar novamente', retryUrl),
      ].join(''),
    }),
  };
}

// ───────────────── 5. Assinatura pausada / cancelada ─────────────────

export function subscriptionStatusEmail(opts: {
  action: 'pausada' | 'cancelada';
  effectiveDate: string | null;
}): EmailPayload {
  const immediate = !opts.effectiveDate;
  const isPause = opts.action === 'pausada';
  return {
    subject: isPause ? 'Assinatura pausada — Florê Ateliê' : 'Assinatura cancelada — Florê Ateliê',
    html: renderEmailShell({
      eyebrow: isPause ? 'Assinatura pausada' : 'Assinatura cancelada',
      heading: isPause ? 'Sua assinatura está pausada.' : 'Sua assinatura foi cancelada.',
      preheader: immediate ? 'Confirmado agora.' : `Vale a partir de ${opts.effectiveDate ? fmtDateBR(opts.effectiveDate) : ''}.`,
      bodyHtml: [
        immediate
          ? p(isPause ? 'Você não será cobrada nem receberá entregas até decidir retomar.' : 'Não há mais entregas nem cobranças futuras.')
          : p(
              `A próxima entrega já estava confirmada, então ela ainda acontece normalmente. A partir de ${fmtDateBR(opts.effectiveDate as string)}, ${isPause ? 'sua assinatura fica pausada' : 'sua assinatura está encerrada'}.`
            ),
        isPause ? p('Sem prazo — sua assinatura espera por você pelo tempo que precisar. Retome quando quiser em Minha Conta.') : p('Se mudar de ideia, você pode assinar novamente a qualquer momento.'),
        button('Ir para Minha Conta', `${SITE_URL}/assinatura`),
      ].join(''),
    }),
  };
}

// ───────────────────── 6. Lembrete de entrega ─────────────────────

export function deliveryReminderEmail(opts: { deliveryDate: string; description: string }): EmailPayload {
  return {
    subject: 'Sua entrega é amanhã — Florê Ateliê',
    html: renderEmailShell({
      eyebrow: 'Lembrete',
      heading: 'Sua entrega é amanhã.',
      preheader: `${fmtDateBR(opts.deliveryDate)} — ${opts.description}`,
      bodyHtml: [p(`${escapeHtml(opts.description)}, com entrega prevista para ${fmtDateBR(opts.deliveryDate)}.`)].join(''),
    }),
  };
}

// ───────────────── 7. Notificação interna (admin) ─────────────────

export function adminNewOrderEmail(opts: {
  orderId: string;
  kind: 'avulso' | 'assinatura';
  customerName: string;
  customerPhone: string;
  items: OrderConfirmationItem[];
  address: { street: string; number: string; complement?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null };
  deliveryDate: string | null;
  total: number;
}): EmailPayload {
  const addr = opts.address;
  const addrLine = `${addr.street}, ${addr.number}${addr.complement ? ` — ${addr.complement}` : ''}`;
  const addrCity = [addr.neighborhood, addr.city && addr.state ? `${addr.city}/${addr.state}` : null].filter(Boolean).join(' · ');
  const itemsHtml = opts.items.map((i) => row(i.qty > 1 ? `${i.name} (×${i.qty})` : i.name, fmtBRL(i.unitPrice * i.qty))).join('');

  return {
    subject: `Novo pedido pago — ${opts.kind === 'assinatura' ? 'Assinatura' : 'Avulso'} #${opts.orderId.slice(0, 8)}`,
    html: renderEmailShell({
      eyebrow: 'Novo pedido pago',
      heading: `${opts.kind === 'assinatura' ? 'Ciclo de assinatura' : 'Pedido avulso'} confirmado.`,
      preheader: `${opts.customerName} · ${opts.deliveryDate ? fmtDateBR(opts.deliveryDate) : 'sem data'}`,
      bodyHtml: [
        summaryBlock(
          row('Cliente', opts.customerName) +
            row('WhatsApp', opts.customerPhone || '—') +
            (opts.deliveryDate ? row('Entrega', fmtDateBR(opts.deliveryDate)) : '') +
            row('Total', fmtBRL(opts.total))
        ),
        `<p style="margin: 0 0 6px; font-weight: bold; color:#4B5740;">Itens</p>`,
        summaryBlock(itemsHtml),
        `<p style="margin: 0 0 6px; font-weight: bold; color:#4B5740;">Endereço</p>`,
        p(`${addrLine}${addrCity ? ` · ${addrCity}` : ''}`),
      ].join(''),
    }),
  };
}
