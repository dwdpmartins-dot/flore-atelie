-- Replaces the 9 placeholder catálogo products (6 'catalogo' + 3
-- 'avulso_pronto', shown together at /catalogo since 0004's merge) with
-- 17 real products, all under context='catalogo'. Deactivated rather than
-- deleted, same reasoning as the flower curation migration (0008):
-- order_items references bouquets(id) with no cascade, so a past order
-- using one of these would break if the row were removed outright.
--
-- ids are the exact kebab-case slugs from the naming convention, doubling
-- as the /catalogo/[slug] route param -- no separate slug column needed.
-- image_path points at /assets/<slug>.jpg; those files are placeholders
-- (existing stock photos, copied under the new filenames) until the real
-- photos are delivered under the same names -- see the chat reply for the
-- full list of which slugs are still placeholders.

update public.bouquets set active = false
where id in ('b1','b2','b3','b4','b5','b6','r1','r2','r3');

insert into public.bouquets (id, context, name, description, price, image_path, sort_order) values
  ('35-motivos-para-te-amar', 'catalogo', '35 Motivos para Te Amar', 'Um buquê denso em tons de rosa e lilás, embrulhado em folha verde-viva. Ideal para dizer muito com um só gesto.', 420, '/assets/35-motivos-para-te-amar.jpg', 1),
  ('arranjo-campestre-com-vaso', 'catalogo', 'Arranjo Campestre com Vaso', 'Mix vibrante de rosa, laranja e magenta em vaso de vidro, hastes altas e soltas. Já chega pronto para a mesa.', 320, '/assets/arranjo-campestre-com-vaso.jpg', 2),
  ('arranjo-de-gerberas-e-calas-grande', 'catalogo', 'Arranjo de Gérberas e Calas Grande', 'Gérberas laranja e copos-de-leite vermelhos, servidos em caneca estampada. Cor sem meio-termo.', 389, '/assets/arranjo-de-gerberas-e-calas-grande.jpg', 3),
  ('arranjo-de-mesa-encanto-rosa', 'catalogo', 'Arranjo de Mesa Encanto Rosa', 'Composição alta e cheia, em tons de rosa e magenta, montada em vaso estruturado. Presença de centro de mesa.', 499, '/assets/arranjo-de-mesa-encanto-rosa.jpg', 4),
  ('arranjo-silvestre-amarelo-grande-com-vaso', 'catalogo', 'Arranjo Silvestre Amarelo Grande com Vaso', 'Amarelo e branco em harmonia silvestre, como um campo em miniatura. Pronto no próprio vaso.', 399, '/assets/arranjo-silvestre-amarelo-grande-com-vaso.jpg', 5),
  ('box-por-do-sol', 'catalogo', 'Box Pôr do Sol', 'Mix de laranja, magenta e roxo profundo, na caixa preta assinada Florê Ateliê, com laço.', 399, '/assets/box-por-do-sol.jpg', 6),
  ('buque-50-rosas', 'catalogo', 'Buquê 50 Rosas', 'Cinquenta rosas vermelhas, envoltas em papel terracota. Para o gesto que não precisa de explicação.', 700, '/assets/buque-50-rosas.jpg', 7),
  ('buque-campo-e-ceu-m', 'catalogo', 'Buquê Campo & Céu M', 'Hortênsia azul, gérbera rosa e toques de laranja, amarrados com barbante rústico.', 340, '/assets/buque-campo-e-ceu-m.jpg', 8),
  ('buque-cone-mini', 'catalogo', 'Buquê Cone Mini', 'Pequeno buquê em tons lilás e branco, em cone de papel kraft. O tamanho certo para o dia a dia.', 69, '/assets/buque-cone-mini.jpg', 9),
  ('buque-de-tulipa', 'catalogo', 'Buquê de Tulipa', 'Tulipas em laranja e vermelho vibrante, com eucalipto e embrulho verde. Um clássico revisitado.', 320, '/assets/buque-de-tulipa.jpg', 10),
  ('buque-do-campo', 'catalogo', 'Buquê do Campo', 'Ranúnculos laranja e margaridas brancas, amarrados com fita. Leve, como flor recém-colhida.', 240, '/assets/buque-do-campo.jpg', 11),
  ('buque-noiva', 'catalogo', 'Buquê Noiva', 'Rosas brancas e creme em formato redondo clássico, cabo revestido em cetim. Elegância atemporal.', 999, '/assets/buque-noiva.jpg', 12),
  ('buque-tropical-g', 'catalogo', 'Buquê Tropical G', 'Tulipas, gérberas e girassol em mix tropical vibrante, amarrado com barbante natural.', 360, '/assets/buque-tropical-g.jpg', 13),
  ('cesta-rustica-de-outono', 'catalogo', 'Cesta Rústica de Outono', 'Girassóis e flores laranja/rosa, em cesta de vime com laço verde. Aconchego de outono.', 400, '/assets/cesta-rustica-de-outono.jpg', 14),
  ('flor-da-estacao', 'catalogo', 'Flor da Estação', 'Seleção surpresa com o que está mais bonito na estação. Cada entrega é única.', 220, '/assets/flor-da-estacao.jpg', 15),
  ('orquidea-cascata', 'catalogo', 'Orquídea Cascata', 'Orquídeas magenta com amaranthus em cascata, criando movimento e altura.', 350, '/assets/orquidea-cascata.jpg', 16),
  ('orquidea-cascata-com-vaso', 'catalogo', 'Orquídea Cascata com Vaso', 'A mesma composição em cascata, já em vaso de vidro, pronta para exibir.', 500, '/assets/orquidea-cascata-com-vaso.jpg', 17)
on conflict (id) do update set
  context = excluded.context,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  image_path = excluded.image_path,
  sort_order = excluded.sort_order,
  active = true;
