-- Public bucket for AI-generated bouquet illustrations (Monte seu Buquê).
-- Only runs against a real Supabase project — the `storage` schema is part
-- of Supabase's managed Postgres, not present on a bare Postgres instance
-- (this migration was intentionally not exercised in the local-Postgres
-- test pass that validated 0001-0004; verify it after `supabase db push`).
insert into storage.buckets (id, name, public)
values ('illustrations', 'illustrations', true)
on conflict (id) do nothing;
