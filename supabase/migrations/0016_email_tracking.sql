-- Idempotency guards for transactional emails (src/lib/email). Every one of
-- these is "have we already sent this specific notification" state, checked
-- and claimed atomically (`... where x is null`) right before sending, so a
-- webhook redelivery or a retried action never double-sends the same email.

alter table public.customers add column if not exists welcome_email_sent_at timestamptz;

-- Tracks the last order status we've already emailed the customer about, so
-- a webhook re-delivery for the same status transition doesn't re-send (but
-- a later, different transition -- e.g. pendente -> pagamento_recusado ->
-- em_andamento on a retried payment -- still gets its own email each time).
alter table public.orders add column if not exists status_email_sent_for text;
alter table public.orders add column if not exists admin_notified_at timestamptz;
alter table public.orders add column if not exists reminder_email_sent_at timestamptz;

alter table public.subscription_deliveries add column if not exists reminder_email_sent_at timestamptz;
