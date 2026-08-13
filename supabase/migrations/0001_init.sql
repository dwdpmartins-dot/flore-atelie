-- Florê Ateliê — core schema
-- Ports the entities implicit in the Claude Design prototype
-- (project/Flore Atelie.dc.html) into real tables.

create extension if not exists "pgcrypto";

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ===================== CUSTOMERS =====================
-- One row per authenticated shopper, keyed 1:1 to auth.users.
create table public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  nickname text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customers_set_updated_at before update on public.customers
  for each row execute function set_updated_at();

-- Auto-provision a customers row whenever a new auth user signs up
-- (email/password or Google OAuth both land here).
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.customers (id, email, name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===================== ADMIN =====================
-- Allowlist of auth.users who may access /admin. Bootstrap the first
-- admin manually after deploy — see supabase/README.md.
create table public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ===================== ADDRESSES =====================
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  cep text not null,
  street text not null,        -- resolved via ViaCEP, read-only to the customer
  neighborhood text,
  city text,
  state text,
  number text not null,
  complement text,
  label text not null,         -- derived from street (prototype: "Endereço", not user-editable)
  preferred boolean not null default false,
  lat double precision,
  lng double precision,
  distance_km numeric(6,2),    -- cached geocoded distance from the atelier
  created_at timestamptz not null default now()
);
create index addresses_customer_id_idx on public.addresses(customer_id);
create unique index addresses_one_preferred_per_customer
  on public.addresses(customer_id) where preferred;

-- ===================== SAVED CARDS =====================
-- Mercado Pago tokenized references ONLY — never a PAN/CVV.
create table public.saved_cards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  mp_customer_id text not null,
  mp_card_id text not null,
  brand text,
  last4 text,
  cardholder_name text,
  created_at timestamptz not null default now(),
  unique (customer_id, mp_card_id)
);
create index saved_cards_customer_id_idx on public.saved_cards(customer_id);

-- ===================== FLOWERS (Monte seu Buquê catalog) =====================
create table public.flowers (
  id text primary key, -- slug, matches prototype ids (rosa, tulipa, ...)
  name text not null,
  price numeric(8,2) not null,
  active boolean not null default true,
  sort_order int not null default 0
);

-- ===================== BOUQUETS =====================
-- context='catalogo'      -> the Catálogo grid (6 authored bouquets)
-- context='avulso_pronto' -> Buquê Avulso > "Prontos" tab (3 options)
create table public.bouquets (
  id text primary key,
  context text not null check (context in ('catalogo','avulso_pronto')),
  name text not null,
  description text,
  price numeric(8,2) not null,
  image_path text not null,
  category text, -- Buquês | Arranjos | Sazonais (catalogo only; nullable otherwise)
  active boolean not null default true,
  sort_order int not null default 0
);

-- ===================== GALLERY =====================
-- Home "Buquês reais da Florê" gallery; also the reference used by
-- "Buquê Inspirado da Florê" when a customer picks a specific photo.
create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  caption text not null,
  price_p numeric(8,2) not null,
  price_m numeric(8,2) not null,
  price_g numeric(8,2) not null,
  sort_order int not null default 0
);

-- ===================== TESTIMONIALS =====================
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null,
  author_name text not null,
  sort_order int not null default 0,
  active boolean not null default true
);

-- ===================== SUBSCRIPTION PLANS (pricing matrix) =====================
create table public.subscription_plans (
  freq text not null check (freq in ('Semanal','Quinzenal','Mensal')),
  size text not null check (size in ('P','M','G')),
  price numeric(8,2) not null,
  primary key (freq, size)
);

-- ===================== SUBSCRIPTIONS =====================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  freq text not null check (freq in ('Semanal','Quinzenal','Mensal')),
  size text not null check (size in ('P','M','G')),
  weekday text not null check (weekday in ('Segunda','Terça','Quarta','Quinta','Sexta','Sábado')),
  status text not null default 'ativa' check (status in ('ativa','pausada','cancelada')),
  message text not null default '',
  recipient_name text, -- optional gift recipient; never affects billing/address owner
  address_id uuid references public.addresses(id),
  card_id uuid references public.saved_cards(id),
  price numeric(8,2) not null,
  paused_since date,
  -- {type: 'pause'|'cancel', effective_date: date} — set when the action was
  -- requested after the next cycle's cutoff already passed.
  pending_action jsonb,
  -- {freq, size, effective_date} — set when a plan/size change can't apply
  -- to an already-locked next cycle.
  pending_plan_change jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function set_updated_at();
create index subscriptions_customer_id_idx on public.subscriptions(customer_id);

-- ===================== SUBSCRIPTION DELIVERIES =====================
-- One row per billing/delivery cycle. cutoff_date is when the card is
-- charged (3 business days before delivery_date) — see 0002_functions.sql.
create table public.subscription_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  sequence_index int not null,
  delivery_date date not null,
  cutoff_date date not null,
  message text not null default '',
  recipient_name text,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','skipped')),
  charged_at timestamptz,
  mp_payment_id text,
  created_at timestamptz not null default now()
);
create index subscription_deliveries_subscription_id_idx on public.subscription_deliveries(subscription_id);
create index subscription_deliveries_pending_cutoff_idx
  on public.subscription_deliveries(cutoff_date) where payment_status = 'pending';

-- ===================== ORDERS =====================
-- Unifies avulso purchases and subscription billing events into one
-- history table (the prototype kept these separate and flagged it as an
-- open schema question — this is the resolution).
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null check (kind in ('avulso','assinatura')),
  subscription_delivery_id uuid references public.subscription_deliveries(id),
  status text not null default 'pendente'
    check (status in ('pendente','em_andamento','entregue','cancelado','pagamento_recusado')),
  subtotal numeric(9,2) not null default 0,
  shipping_fee numeric(9,2) not null default 0,
  total numeric(9,2) not null default 0,
  address_id uuid references public.addresses(id),
  delivery_date date,
  delivery_period text check (delivery_period in ('manha','tarde')),
  payment_method text check (payment_method in ('card','pix')),
  installments int not null default 1,
  mp_payment_id text,
  mp_status text,
  message text,
  recipient_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger orders_set_updated_at before update on public.orders
  for each row execute function set_updated_at();
create index orders_customer_id_idx on public.orders(customer_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null check (item_type in ('catalog_bouquet','ready_option','inspirado','custom_builder','subscription')),
  ref_id text, -- bouquets.id / gallery_photos.id / flowers.id, when applicable
  name_snapshot text not null,
  unit_price numeric(8,2) not null,
  qty int not null default 1,
  subtotal numeric(9,2) not null
);
create index order_items_order_id_idx on public.order_items(order_id);

-- Flower composition for order_items of type 'custom_builder'.
create table public.order_item_flowers (
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  flower_id text not null references public.flowers(id),
  qty int not null,
  primary key (order_item_id, flower_id)
);

-- ===================== SETTINGS (admin-managed config) =====================
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger settings_set_updated_at before update on public.settings
  for each row execute function set_updated_at();

-- ===================== CEP / GEOCODING CACHE =====================
-- Server-side only (no RLS policy grants it to anon/authenticated).
-- Keeps us within Nominatim's 1 req/s usage policy.
create table public.cep_cache (
  cep text primary key,
  street text,
  neighborhood text,
  city text,
  state text,
  lat double precision,
  lng double precision,
  distance_km numeric(6,2),
  updated_at timestamptz not null default now()
);

-- ===================== WEBHOOK EVENTS (Mercado Pago audit log) =====================
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mercadopago',
  event_type text,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
