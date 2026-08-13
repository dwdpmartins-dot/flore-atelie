'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { resolveAddress } from '@/lib/geocoding/resolveAddress';
import { chargeSavedCard, chargeCardToken, createPixPayment, getPaymentStatus } from '@/lib/mercadopago/server';
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
  deliveryPeriod: 'manha' | 'tarde';
  paymentMethod: 'card' | 'pix';
  cardId?: string;
  newCardToken?: string;
  installments?: number;
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

  const { data: customer } = await supabase.from('customers').select('*').eq('id', user.id).maybeSingle();
  const { data: address } = await supabase.from('addresses').select('*').eq('id', input.addressId).eq('customer_id', user.id).maybeSingle();
  if (!address) return { error: 'Endereço inválido.' as const };

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
      delivery_period: input.deliveryPeriod,
      payment_method: input.paymentMethod,
      installments: input.installments ?? 1,
      message: input.message,
    })
    .select()
    .single();

  if (orderError || !order) return { error: 'Não foi possível criar o pedido.' as const };

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
        externalReference,
        payerEmail,
      });
    } else {
      return { error: 'Escolha uma forma de pagamento.' as const };
    }

    if (payment.status !== 'approved') {
      await supabase.from('orders').update({ status: 'pagamento_recusado', mp_status: payment.status }).eq('id', order.id);
      return { declined: true as const };
    }

    await supabase
      .from('orders')
      .update({ status: 'em_andamento', mp_payment_id: String(payment.id), mp_status: payment.status })
      .eq('id', order.id);

    revalidatePath('/minha-conta');
    return { success: true as const, orderId: order.id as string };
  } catch {
    await supabase.from('orders').update({ status: 'pagamento_recusado' }).eq('id', order.id);
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
  }
  return { status };
}
