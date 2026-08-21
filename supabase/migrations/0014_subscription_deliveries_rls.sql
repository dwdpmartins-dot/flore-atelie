-- subscription_deliveries only ever had a SELECT policy (0003_rls.sql).
-- Every mutation the customer-facing flow actually needs -- creating the
-- first delivery via build_delivery_schedule (a SECURITY INVOKER function,
-- so its INSERT runs as the calling customer, not the service role),
-- clearing pending deliveries on pause/cancel/plan-change, editing an
-- upcoming delivery's message -- all go through the regular user-scoped
-- Supabase client. Row Level Security silently blocked every one of these
-- under a real customer session, and nothing checked the RPC/query error,
-- so a freshly created subscription's delivery row simply never existed.

drop policy if exists "deliveries owner read" on public.subscription_deliveries;

create policy "deliveries owner all" on public.subscription_deliveries for all
  using (exists (
    select 1 from public.subscriptions s
    where s.id = subscription_id and s.customer_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.subscriptions s
    where s.id = subscription_id and s.customer_id = auth.uid()
  ));
