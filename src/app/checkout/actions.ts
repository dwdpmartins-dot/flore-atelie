'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveAddress } from '@/lib/geocoding/resolveAddress';
import { chargeSavedCard, chargeCardToken, createPixPayment, getPaymentStatus, attachCardResilient, logMpError } from '@/lib/mercadopago/server';
import { isSimulatingDecline } from '@/lib/mercadopago/simulate';
import { BUILDER_MIN_TOTAL } from '@/lib/builder/constants';
import { upcomingDeliverableDates, todayISO } from '@/lib/delivery/holidays';
import { sendOrderConfirmationEmail, sendOrderDeclinedEmail, sendAdminNewOrderNotification } from '@/lib/email/send';
import type { Database } from '@/lib/supabase/types';

export interface CheckoutItem {
  key: string;
  label: string;
  price: number;
  qty: number;
  kind: string;
}

export interface PayAvulsoInput {
  items: CheckoutItem[];
  message: string;
  addressId: string;
  deliveryDate: string;
  deliveryPeriod: 'manha' | 'tarde';
  paymentMethod: 'card' | 'pix';
  cardId?: string;
  newCardToken?: string;
  installments?: number;
  /** Only set for a brand-new card, straight from the Card Payment Brick. */
  paymentMethodId?: string;
  issuerId?: string;
}

const itemTypeFor = (kind: string): Database['public']['Tables']['order_items']['Row']['item_type'] => {
  if (kind.startsWith('Buquê Avulso · Inspirado')) return 'inspirado';
  if (kind.startsWith('Buquê Avulso · Pronto')) return 'ready_option';
  if (kind === 'Monte seu Buquê') return 'custom_builder';
  return 'catalog_bouquet';
};

export async function payAvulsoOrder(input: PayAvulsoInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' as const };

  if (input.items.length === 0) return { error: 'Carrinho vazio.' as const };

  // The cart is client-managed state (localStorage), so the builder's own
  // "Adicionar ao carrinho" gating (BouquetBuilder.tsx) isn't enough on its
  // own — re-check the minimum here against whatever price the client
  // actually submitted for each "Monte seu Buquê" item.
  const underMinimumItem = input.items.find((i) => i.kind === 'Monte seu Buquê' && i.price < BUILDER_MIN_TOTAL);
  if (underMinimumItem) {
    return { error: `O valor mínimo do buquê é R$ ${BUILDER_MIN_TOTAL}.` };
  }

  // Same reasoning as the shipping fee: the date picker's options
  // (CheckoutFlow.tsx) are computed client-side for display, but the
  // actual allowed window -- tomorrow at the earliest, up to 7 days out,
  // no Sundays/holidays -- is recomputed and enforced here.
  if (!upcomingDeliverableDates(todayISO(), 1, 7).includes(input.deliveryDate)) {
    return { error: 'Data de entrega inválida. Escolha uma data disponível.' as const };
  }

  const { data: customer } = await supabase.from('customers').select('*').eq('id', user.id).maybeSingle();
  const { data: address } = await supabase.from('addresses').select('*').eq('id', input.addressId).eq('customer_id', user.id).maybeSingle();
  if (!address) return { error: 'Endereço inválido.' as const };
  // Addresses can only be saved for served states (see addAddress), but this
  // guards any saved before that rule existed, or added by another path.
  if (address.state !== 'SP') return { error: 'Por enquanto entregamos apenas no estado de São Paulo (SP).' as const };

  // Never trust a client-supplied shipping fee — recompute from the
  // address's own CEP server-side.
  const resolved = await resolveAddress(address.cep);
  const shippingFee = resolved?.shippingFee ?? 30;

  const subtotal = input.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = Math.round((subtotal + shippingFee) * 100) / 100;
  const externalReference = `avulso-${user.id}-${Date.now()}`;
  const payerEmail = customer?.email || user.email || '';

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: user.id,
      kind: 'avulso',
      status: 'pendente',
      subtotal,
      shipping_fee: shippingFee,
      total,
      address_id: input.addressId,
      delivery_date: input.deliveryDate,
      delivery_period: input.deliveryPeriod,
      payment_method: input.paymentMethod,
      installments: input.installments ?? 1,
      message: input.message,
    })
    .select()
    .single();

  if (orderError || !order) return { error: 'Não foi possível criar o pedido.' as const };

  const admin = createAdminClient();

  await supabase.from('order_items').insert(
    input.items.map((i) => ({
      order_id: order.id,
      item_type: itemTypeFor(i.kind),
      name_snapshot: i.label,
      unit_price: i.price,
      qty: i.qty,
      subtotal: i.price * i.qty,
    }))
  );

  if (input.paymentMethod === 'pix') {
    try {
      const pix = await createPixPayment({
        amount: total,
        description: 'Florê Ateliê — Pedido avulso',
        externalReference,
        payerEmail,
        payerFirstName: customer?.name ?? undefined,
      });
      await supabase.from('orders').update({ mp_payment_id: String(pix.id), mp_status: pix.status }).eq('id', order.id);
      revalidatePath('/minha-conta');
      return { success: true as const, orderId: order.id as string, pix: { qrCodeBase64: pix.qrCodeBase64, qrCode: pix.qrCode, expiresAt: pix.expiresAt } };
    } catch {
      await supabase.from('orders').update({ status: 'cancelado' }).eq('id', order.id);
      return { error: 'Não foi possível gerar o PIX agora.' as const };
    }
  }

  if (await isSimulatingDecline(supabase)) {
    await supabase.from('orders').update({ status: 'pagamento_recusado', mp_status: 'simulated_decline' }).eq('id', order.id);
    await sendOrderDeclinedEmail(admin, order.id);
    return { declined: true as const };
  }

  // Card payment: either a saved card or a freshly tokenized one.
  try {
    let payment;
    if (input.cardId) {
      const { data: card } = await supabase.from('saved_cards').select('*').eq('id', input.cardId).eq('customer_id', user.id).maybeSingle();
      if (!card) return { error: 'Cartão inválido.' as const };
      payment = await chargeSavedCard({
        mpCustomerId: card.mp_customer_id,
        mpCardId: card.mp_card_id,
        amount: total,
        description: 'Florê Ateliê — Pedido avulso',
        installments: input.installments,
        externalReference,
        payerEmail,
      });
    } else if (input.newCardToken) {
      payment = await chargeCardToken({
        token: input.newCardToken,
        amount: total,
        description: 'Florê Ateliê — Pedido avulso',
        installments: input.installments,
        paymentMethodId: input.paymentMethodId,
        issuerId: input.issuerId,
        externalReference,
        payerEmail,
      });
    } else {
      return { error: 'Escolha uma forma de pagamento.' as const };
    }

    if (payment.status !== 'approved') {
      // Not an exception -- Mercado Pago responded fine, just with a
      // non-approved status. status_detail is where the actual reason
      // lives and was never logged here before, only stored as mp_status
      // (the bare status, no detail) and swallowed into a generic
      // "declined" for the customer.
      console.log('payAvulsoOrder: payment not approved', {
        paymentId: payment.id,
        status: payment.status,
        statusDetail: payment.status_detail,
      });
      await supabase.from('orders').update({ status: 'pagamento_recusado', mp_status: payment.status }).eq('id', order.id);
      await sendOrderDeclinedEmail(admin, order.id);
      return { declined: true as const };
    }

    await supabase
      .from('orders')
      .update({ status: 'em_andamento', mp_payment_id: String(payment.id), mp_status: payment.status })
      .eq('id', order.id);
    await Promise.all([sendOrderConfirmationEmail(admin, order.id), sendAdminNewOrderNotification(admin, order.id)]);

    // A brand-new card that just paid successfully is saved for next time
    // — never as the default (an explicit choice the customer never made
    // just by checking out), just stored so it shows up in Minha Conta >
    // Cartões and doesn't have to be retyped. Best-effort: if this fails
    // for any reason (e.g. Mercado Pago's card token has already expired
    // by the time we get here), the order itself already succeeded and
    // stays that way — the customer only loses the convenience of a saved
    // card next time, not the purchase.
    if (input.newCardToken) {
      try {
        const { mpCustomerId, card } = await attachCardResilient({
          existingMpCustomerId: customer?.mp_customer_id ?? null,
          email: payerEmail,
          name: customer?.name,
          token: input.newCardToken,
        });
        if (mpCustomerId !== customer?.mp_customer_id) {
          await supabase.from('customers').update({ mp_customer_id: mpCustomerId }).eq('id', user.id);
        }
        await supabase.from('saved_cards').insert({
          customer_id: user.id,
          mp_customer_id: mpCustomerId,
          mp_card_id: card.mpCardId,
          brand: card.brand ?? null,
          last4: card.last4 ?? null,
          cardholder_name: card.cardholderName ?? null,
          preferred: false,
        });
      } catch (err) {
        logMpError('payAvulsoOrder: best-effort card save after checkout failed', err);
      }
    }

    revalidatePath('/minha-conta');
    return { success: true as const, orderId: order.id as string };
  } catch {
    await supabase.from('orders').update({ status: 'pagamento_recusado' }).eq('id', order.id);
    await sendOrderDeclinedEmail(admin, order.id);
    return { declined: true as const };
  }
}

export async function checkPixStatus(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).eq('customer_id', user.id).maybeSingle();
  if (!order?.mp_payment_id) return { status: 'pending' };

  const status = await getPaymentStatus(order.mp_payment_id);
  if (status === 'approved' && order.status !== 'em_andamento') {
    await supabase.from('orders').update({ status: 'em_andamento', mp_status: status }).eq('id', orderId);
    const admin = createAdminClient();
    await Promise.all([sendOrderConfirmationEmail(admin, orderId), sendAdminNewOrderNotification(admin, orderId)]);
  }
  return { status };
}
