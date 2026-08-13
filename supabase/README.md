# Supabase — Florê Ateliê

## Aplicando as migrations

Com o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e logado:

```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```

Isso roda, em ordem, tudo em `migrations/`:

1. `0001_init.sql` — todas as tabelas (clientes, endereços, cartões
   tokenizados, flores, buquês, galeria, assinaturas, entregas, pedidos,
   configurações admin, cache de CEP, log de webhooks).
2. `0002_functions.sql` — lógica de dias úteis e geração de agenda de
   entregas em Postgres (`subtract_business_days`, `build_delivery_schedule`,
   `is_cutoff_passed`) — fonte única de verdade, usada tanto pela API quanto
   pelo cron de cobrança, para a data de corte nunca divergir entre lugares.
3. `0003_rls.sql` — Row Level Security: a chave pública (anon/authenticated)
   só enxerga as próprias linhas do cliente logado. Leitura/escrita
   entre clientes (admin, cron, webhook) usa a *service role key* no
   servidor, nunca exposta ao navegador.
4. `0004_seed.sql` — dados reais já validados no protótipo (16 flores,
   9 buquês/arranjos, 10 fotos da galeria com preço próprio por tamanho,
   2 depoimentos, matriz de preços de assinatura, fórmula de frete).

Todas as 4 migrations foram testadas localmente (Postgres 16, com um schema
`auth` simulado) antes de entrarem no repositório — sem erros.

## Promovendo o primeiro admin

O painel `/admin` é protegido por autenticação real (Supabase Auth) + uma
allowlist (`admin_users`), não por usuário/senha simulados como no
protótipo. Depois que a pessoa administradora criar uma conta normal pelo
site (ou por `supabase.auth.admin.createUser`), promova-a rodando no SQL
Editor do Supabase:

```sql
insert into public.admin_users (id)
select id from auth.users where email = 'admin@floreatelie.com.br';
```

## Variáveis de ambiente necessárias

Veja `.env.example` na raiz do repositório — chaves do Supabase, Mercado
Pago, OpenAI e geocoding.
