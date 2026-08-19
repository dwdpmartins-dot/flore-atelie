-- Points the 17 real products (0010) at their actual photos, now uploaded
-- to the "Catalogo Flore" public Storage bucket, instead of the local
-- stock-photo placeholders 0010 shipped with. Public Storage URL shape:
-- https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<file>
-- next.config.js already allows any *.supabase.co host for next/image, so
-- no code change needed alongside this migration.

update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/35%20Motivos%20para%20Te%20Amar%20-%20420.png' where id = '35-motivos-para-te-amar';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Arranjo%20Campestre%20com%20Vaso%20-320.png' where id = 'arranjo-campestre-com-vaso';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Arranjo%20de%20Gerberas%20e%20Calas%20Grande%20-%20389.png' where id = 'arranjo-de-gerberas-e-calas-grande';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Arranjo%20de%20Mesa%20Encanto%20Rosa%20-%20499.png' where id = 'arranjo-de-mesa-encanto-rosa';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Arranjo%20Silvestre%20Amarelo%20Grande%20com%20vaso%20-%20399.png' where id = 'arranjo-silvestre-amarelo-grande-com-vaso';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Box%20por%20do%20sol%20-%20399.png' where id = 'box-por-do-sol';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Buque%2050%20rosas%20-%20700.png' where id = 'buque-50-rosas';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Buque%20Campo%20e%20Ceu%20M%20-%20340.png' where id = 'buque-campo-e-ceu-m';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Buque%20Cone%20Mini%20-%2069.png' where id = 'buque-cone-mini';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Buque%20de%20Tulipa%20-%20320.png' where id = 'buque-de-tulipa';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Buque%20do%20Campo%20-%20240.png' where id = 'buque-do-campo';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Buque%20Noiva%20-%20999.png' where id = 'buque-noiva';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Buque%20Tropical%20G%20-%20360.png' where id = 'buque-tropical-g';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Cesta%20Rustica%20de%20Outono%20-%20400.png' where id = 'cesta-rustica-de-outono';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Flor%20da%20Estacao%20-%20220.png' where id = 'flor-da-estacao';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Orquidea%20Cascata%20-%20350.png' where id = 'orquidea-cascata';
update public.bouquets set image_path = 'https://kpscvlajdbkcnknjeeag.supabase.co/storage/v1/object/public/Catalogo%20Flore/Orquidea%20Cascata%20com%20Vaso%20-%20500.png' where id = 'orquidea-cascata-com-vaso';
