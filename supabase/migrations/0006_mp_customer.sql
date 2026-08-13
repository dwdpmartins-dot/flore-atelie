-- Mercado Pago customer id, so we reuse one MP Customer per Florê customer
-- instead of creating a new one on every saved card.
alter table public.customers add column if not exists mp_customer_id text;
