import 'server-only';

export interface ViaCepResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

/** Resolves a Brazilian CEP into street/neighborhood/city/state. No API key needed. */
export async function fetchViaCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    // ViaCEP responses are effectively static per CEP — safe to cache at the edge.
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (data.erro) return null;

  return {
    cep: digits,
    street: data.logradouro || '',
    neighborhood: data.bairro || '',
    city: data.localidade || '',
    state: data.uf || '',
  };
}
