-- Curate "Monte seu Buquê" down to the 9 flowers the ateliê actually
-- offers, with new prices. Existing flowers outside this list are
-- deactivated (active = false), never deleted: order_item_flowers.flower_id
-- references flowers(id) with no cascade, so deleting a row a past order
-- already used would break that order's history. Deactivating already
-- hides a flower from the builder on its own (see the "public read
-- flowers" RLS policy: active = true) without touching anything
-- historical. Names/prices below use the accented Portuguese spelling to
-- match the rest of the catalog (Gérbera, Orquídea, ...).

-- Flowers that stay, updated in place under their existing ids so any
-- past order referencing them keeps a sensible label/price snapshot.
update public.flowers set name = 'Gérbera', price = 12, sort_order = 1 where id = 'gerbera';
update public.flowers set name = 'Antúrio', price = 15, sort_order = 5 where id = 'antulio';
update public.flowers set name = 'Folhagens verdes', price = 8, sort_order = 6 where id = 'folhagens';
update public.flowers set name = 'Girassol', price = 15, sort_order = 7 where id = 'girasol';
update public.flowers set name = 'Orquídea', price = 60, sort_order = 9 where id = 'orquidea';

-- "Rosa" is replaced by 3 separate color variants -- deactivate the old
-- single entry and add the new ones (kept if this migration re-runs).
update public.flowers set active = false where id = 'rosa';

insert into public.flowers (id, name, price, active, sort_order) values
  ('rosa_vermelha', 'Rosas Vermelhas', 10, true, 2),
  ('rosa_branca', 'Rosas Brancas', 10, true, 3),
  ('rosa_cor_rosa', 'Rosas cor Rosa', 10, true, 4),
  ('boca_de_leao', 'Boca de Leão', 12, true, 8)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  active = excluded.active,
  sort_order = excluded.sort_order;

-- Everything else (rusgos, eucalipto, alstromélia, lírio, flor do campo,
-- celósia, estatícia, rabo de gato, rosa spray, tulipa, ...) drops off the
-- builder.
update public.flowers set active = false
where id not in ('gerbera','rosa_vermelha','rosa_branca','rosa_cor_rosa','antulio','folhagens','girasol','boca_de_leao','orquidea');
