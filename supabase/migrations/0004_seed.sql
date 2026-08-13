-- Seed data ported verbatim from the validated prototype
-- (project/Flore Atelie.dc.html state: flowerTypes, readyBouquets,
-- readyOptions, galleryPhotos, testimonials, plans). These are the
-- already-approved values — do not "round" or otherwise adjust them.

insert into public.flowers (id, name, price, sort_order) values
  ('rusgos','Rusgos',13,1),
  ('eucalipto','Eucalipto',9,2),
  ('alstromelia','Alstromélia',12,3),
  ('gerbera','Gérbera',14,4),
  ('rosa','Rosa',17,5),
  ('lirio','Lírio',19,6),
  ('antulio','Antúrio',18,7),
  ('flordocampo','Flor do Campo',11,8),
  ('celosia','Celósia',14,9),
  ('girasol','Girassol',13,10),
  ('estaticia','Estatícia',10,11),
  ('rabodegato','Rabo de Gato',11,12),
  ('rosaspray','Rosa Spray',14,13),
  ('tulipa','Tulipa',16,14),
  ('folhagens','Folhagens',9,15),
  ('orquidea','Orquídea',21,16);

-- Catálogo (6 authored bouquets)
insert into public.bouquets (id, context, name, description, price, image_path, category, sort_order) values
  ('b1','catalogo','Bilhete de Manhã','Cesta rústica em tons vivos, com folhagens abundantes e flores da estação.',149,'/assets/flore-arranjo-1.png','Arranjos',1),
  ('b2','catalogo','Carta Terracota','Rosas e astromélias em tons quentes, para gestos marcantes.',139,'/assets/flore-arranjo-2.png','Buquês',2),
  ('b3','catalogo','Sussurro Rosa-pó','Ranúnculos e lisianthus em composição delicada.',119,'/assets/flore-arranjo-3.png','Buquês',3),
  ('b4','catalogo','Verso Silvestre','Mix de campo com folhagens abundantes.',99,'/assets/flore-arranjo-4.png','Sazonais',4),
  ('b5','catalogo','Ateliê Completo','Nossa composição autoral mais generosa, cheia de camadas.',189,'/assets/flore-arranjo-5.png','Arranjos',5),
  ('b6','catalogo','Pequena Alegria','Um mimo simples, perfeito para "sem motivo nenhum".',69,'/assets/flore-gallery-box.jpg','Sazonais',6);

-- Buquê Avulso > "Prontos" (3 options)
insert into public.bouquets (id, context, name, description, price, image_path, sort_order) values
  ('r1','avulso_pronto','Encanto Musgo','Verdes profundos com toques de terracota.',129,'/assets/flore-gallery-bench.jpg',1),
  ('r2','avulso_pronto','Doce Pó de Rosa','Composição suave em tons pastel.',139,'/assets/flore-gallery-lavender.jpg',2),
  ('r3','avulso_pronto','Carta de Amor','Rosas e margaridas, o clássico da Florê.',159,'/assets/flore-gallery-purple.jpg',3);

-- Gallery (10 photos, each with its own P/M/G pricing — the first, the
-- "cesta autoral", is intentionally the most expensive of the set).
insert into public.gallery_photos (image_path, caption, price_p, price_m, price_g, sort_order) values
  ('/assets/flore-gallery-basket.jpg','Cesta autoral, flores da estação',189,259,350,1),
  ('/assets/flore-gallery-bench.jpg','Composição em tons pastel',99,149,219,2),
  ('/assets/flore-gallery-vase.jpg','Arranjo de mesa, ateliê',109,159,229,3),
  ('/assets/flore-gallery-wedding.jpg','Buquê autoral em tons de magenta',129,179,249,4),
  ('/assets/flore-gallery-tropical.jpg','Composição tropical vibrante',119,169,239,5),
  ('/assets/flore-gallery-lavender.jpg','Buquê de lavandas e alecrim',99,145,209,6),
  ('/assets/flore-gallery-sunflower.jpg','Girassóis e rosas laranja',109,155,219,7),
  ('/assets/flore-gallery-basket2.jpg','Cesta colorida, mix de estação',149,209,289,8),
  ('/assets/flore-gallery-box.jpg','Caixa autoral Florê Ateliê',139,199,279,9),
  ('/assets/flore-gallery-purple.jpg','Composição em tons de roxo e rosa',119,169,239,10);

-- Testimonials (2, formal tone — matches the last validated round)
insert into public.testimonials (quote, author_name, sort_order) values
  ('Fiquei profundamente emocionada com o cuidado e a sensibilidade de toda a composição. O buquê foi um dos pontos altos do meu casamento — todos os convidados fizeram questão de elogiar.','Isabelle, noiva',1),
  ('Um arranjo belíssimo, que superou minhas expectativas. A escolha das flores demonstrou muito bom gosto e atenção aos detalhes.','Cecília S.',2);

-- Subscription plans: Semanal P = R$99 is the floor, per business rules.
insert into public.subscription_plans (freq, size, price) values
  ('Semanal','P',99), ('Semanal','M',129), ('Semanal','G',159),
  ('Quinzenal','P',119), ('Quinzenal','M',149), ('Quinzenal','G',179),
  ('Mensal','P',139), ('Mensal','M',169), ('Mensal','G',199);

-- Settings: shipping formula (R$30 base + R$4/km, per business rules),
-- AI illustration toggle (default on), Inspirado da Florê fallback pricing
-- (used when no gallery reference photo was selected).
insert into public.settings (key, value) values
  ('shipping_formula', '{"base": 30, "free_km": 3, "per_km": 4}'),
  ('ai_illustration_enabled', 'true'),
  ('inspirado_default_prices', '{"P": 99, "M": 139, "G": 189}'),
  ('simulate_declined_payment', 'false');
