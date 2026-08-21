-- Lets a customer mark one saved card as their default, same idea as
-- addresses.preferred. Checkout/assinatura now pre-select this card
-- instead of just "whichever one the query happened to return first".

alter table public.saved_cards add column if not exists preferred boolean not null default false;
