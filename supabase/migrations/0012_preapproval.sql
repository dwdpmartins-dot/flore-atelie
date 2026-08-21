-- Supports migrating subscription billing to Mercado Pago's Preapproval
-- API (recurring billing MP itself drives, instead of our own cron
-- re-tokenizing a saved card_id every cycle -- the mechanism that's been
-- failing inconsistently). See the chat thread for the full reasoning;
-- this migration only adds what's needed to reference a Preapproval from
-- our own subscription row. Everything else (delivery scheduling, cutoff
-- dates, pause/cancel semantics) is unchanged.

alter table public.subscriptions add column if not exists mp_preapproval_id text;
create index if not exists subscriptions_mp_preapproval_id_idx on public.subscriptions(mp_preapproval_id) where mp_preapproval_id is not null;
