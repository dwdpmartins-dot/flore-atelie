/**
 * CPF validation for PIX checkout.
 *
 * Root cause of the "Não foi possível gerar o PIX agora." failure: PIX
 * payments require payer identification (CPF) in Brazil — it's a Central
 * Bank/BACEN requirement for the PIX rail itself, not a Mercado Pago quirk
 * (their own integration examples always include payer.identification).
 * Card payments never needed this, which is why PIX was the first checkout
 * path to actually hit it — nothing before this collected a CPF anywhere.
 */

/** Real digit-count + checksum validation, not just an 11-digit count —
 * catches the common "all same digit" placeholder (e.g. 111.111.111-11)
 * that Mercado Pago itself rejects. Accepts raw or formatted input. */
export function isValidCpf(input: string): boolean {
  const cpf = input.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);
  const checkDigit = (sliceLen: number) => {
    let sum = 0;
    for (let i = 0; i < sliceLen; i++) sum += digits[i] * (sliceLen + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

/** "00000000000" -> "000.000.000-00", growing as the person types. */
export function formatCpf(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function onlyDigits(input: string): string {
  return input.replace(/\D/g, '');
}
