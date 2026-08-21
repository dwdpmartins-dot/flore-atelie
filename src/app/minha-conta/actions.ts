'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { resolveAddress } from '@/lib/geocoding/resolveAddress';

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const name = String(formData.get('name') || '').slice(0, 60);
  const nickname = String(formData.get('nickname') || '').slice(0, 30);
  const phone = String(formData.get('phone') || '').slice(0, 15);

  const { error } = await supabase.from('customers').update({ name, nickname, phone }).eq('id', user.id);
  revalidatePath('/minha-conta');
  return { error: error?.message };
}

export async function addAddress(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const cep = String(formData.get('cep') || '');
  const number = String(formData.get('number') || '');
  const complement = String(formData.get('complement') || '');

  const resolved = await resolveAddress(cep);
  if (!resolved) return { error: 'CEP não encontrado.' };
  if (!resolved.served) return { error: 'Por enquanto entregamos apenas no estado de São Paulo (SP).' };
  if (!number.trim()) return { error: 'Informe o número.' };

  const { count } = await supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('customer_id', user.id);
  const isFirst = !count;

  const { data: address, error } = await supabase
    .from('addresses')
    .insert({
      customer_id: user.id,
      cep: resolved.cep,
      street: resolved.street,
      neighborhood: resolved.neighborhood,
      city: resolved.city,
      state: resolved.state,
      number,
      complement,
      label: resolved.street || 'Endereço',
      preferred: isFirst,
      distance_km: resolved.distanceKm,
    })
    .select()
    .single();

  revalidatePath('/minha-conta');
  revalidatePath('/assinatura');
  return { error: error?.message, address };
}
