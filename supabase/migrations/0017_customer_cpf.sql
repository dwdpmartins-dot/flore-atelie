-- PIX payments require payer identification (CPF) — a Central Bank/BACEN
-- requirement for the PIX rail itself, confirmed as the root cause of PIX
-- checkout failing with a generic "Não foi possível gerar o PIX agora."
-- (see src/lib/validation/cpf.ts). Nullable: card checkout never needed
-- this, so existing customers won't have one until they pay via PIX once.
alter table public.customers add column if not exists cpf text;
