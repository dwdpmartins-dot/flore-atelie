-- Row Level Security: the anon/authenticated (public) key only ever sees a
-- signed-in customer's own rows. All cross-customer reads/writes (admin
-- panel, cron billing job, Mercado Pago webhook) go through server-side API
-- routes using the Supabase *service role* key, which bypasses RLS, gated by
-- an application-level admin_users check. This keeps the browser-exposed key
-- strictly scoped.

alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.saved_cards enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_deliveries enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_flowers enable row level security;
alter table public.admin_users enable row level security;
alter table public.webhook_events enable row level security;
alter table public.cep_cache enable row level security;

-- Public catalog data: readable by anyone (no login required to browse).
alter table public.flowers enable row level security;
alter table public.bouquets enable row level security;
alter table public.gallery_photos enable row level security;
alter table public.testimonials enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.settings enable row level security;

create policy "public read flowers" on public.flowers for select using (active = true);
create policy "public read bouquets" on public.bouquets for select using (active = true);
create policy "public read gallery" on public.gallery_photos for select using (true);
create policy "public read testimonials" on public.testimonials for select using (active = true);
create policy "public read plans" on public.subscription_plans for select using (true);
create policy "public read settings" on public.settings for select using (true);

create policy "customers read own" on public.customers for select using (auth.uid() = id);
create policy "customers update own" on public.customers for update using (auth.uid() = id);

create policy "addresses owner all" on public.addresses for all
  using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

create policy "cards owner all" on public.saved_cards for all
  using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

create policy "subscriptions owner all" on public.subscriptions for all
  using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

create policy "deliveries owner read" on public.subscription_deliveries for select
  using (exists (
    select 1 from public.subscriptions s
    where s.id = subscription_id and s.customer_id = auth.uid()
  ));

create policy "orders owner all" on public.orders for all
  using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

create policy "order_items owner read" on public.order_items for select
  using (exists (
    select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()
  ));

create policy "order_item_flowers owner read" on public.order_item_flowers for select
  using (exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id and o.customer_id = auth.uid()
  ));

-- admin_users, cep_cache, webhook_events: intentionally no policies, so the
-- anon/authenticated roles get zero access by default (RLS default-denies).
-- Only the service role (server-side) can read/write them.
