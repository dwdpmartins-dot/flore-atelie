# Florê Ateliê

Boutique floral artesanal — catálogo, buquê avulso, "Monte seu Buquê" com
ilustração por IA, e assinatura recorrente com cobrança automática.
Implementação real (Next.js + Supabase + Mercado Pago) do protótipo em
`project/Flore Atelie.dc.html`, construído a partir dos requisitos
discutidos em `chats/`.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Supabase** — Postgres, Auth (e-mail/senha + Google), Storage, RLS
- **Mercado Pago** — cartão via Payment Brick oficial (campos seguros do
  próprio Mercado Pago, parcelamento com juros reais do emissor), PIX via
  API direta, cobrança recorrente de assinatura
- **OpenAI** (`gpt-image-1`) — ilustração paga do buquê montado, atrás de
  um toggle do admin
- **ViaCEP + Nominatim/OpenStreetMap** — resolução de endereço e cálculo
  de frete por distância
- Deploy: **Vercel**, incluindo o cron diário de cobrança de assinaturas

## Setup local

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase/MP/OpenAI
npm run dev
```

### Banco de dados

Veja [`supabase/README.md`](./supabase/README.md) — como aplicar as
migrations, o que cada uma faz, e como promover o primeiro usuário admin.

### Variáveis de ambiente

Veja [`.env.example`](./.env.example) na raiz — todas as chaves
necessárias (Supabase, Mercado Pago, OpenAI, geocoding, cron), com
comentários explicando cada uma.

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Configure todas as variáveis de `.env.example` nas Environment
   Variables do projeto (Production + Preview).
3. `CRON_SECRET`: gere um valor aleatório e configure-o também como env
   var — a Vercel usa esse mesmo valor automaticamente como Bearer token
   ao chamar o cron (`vercel.json` já declara o schedule diário em
   `/api/cron/subscription-billing`).
4. No painel do Supabase, configure Auth conforme
   [`supabase/README.md`](./supabase/README.md) (confirmação de e-mail
   desativada, provider do Google, redirect URLs apontando para o
   domínio de produção).
5. No painel do Mercado Pago, configure a URL de webhook
   (`https://<seu-domínio>/api/webhooks/mercadopago`) e gere
   `MERCADOPAGO_WEBHOOK_SECRET`.
6. Deploy.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção (inclui type-check + lint)
- `npm run lint` — ESLint isolado
- `npm run typecheck` — TypeScript isolado

## Estrutura

```
src/
  app/            rotas (App Router) — páginas + API routes + server actions
  components/     componentes React, organizados por área
  lib/            clientes Supabase/Mercado Pago, geocoding, regras de
                  negócio de assinatura (agendamento, cobrança)
supabase/
  migrations/     schema, funções de data/cutoff, RLS, seed
  README.md       como aplicar e configurar
project/          protótipo original (Claude Design) — referência visual
chats/            transcrição da conversa que definiu os requisitos
```

## O que ainda precisa de verificação com credenciais reais

Este projeto foi construído e testado tanto quanto possível sem acesso a
serviços externos reais (ambiente sem credenciais de Supabase/Mercado
Pago/OpenAI e com acesso de rede restrito). O que foi validado:

- Todas as migrations SQL, testadas contra um Postgres 16 local
  (schema, funções de dias úteis/agendamento, RLS, triggers).
- `npm run build` e `next lint` limpos em todo o código.

O que precisa de um passe com credenciais reais antes de produção:

- Chamadas à API do Mercado Pago (tokenização de cartão, cobrança,
  PIX, webhook) — implementadas conforme a documentação oficial, não
  exercitadas end-to-end.
- Chamadas ao ViaCEP e Nominatim (ambos hosts fora da allowlist de rede
  do ambiente de desenvolvimento usado).
- Geração de ilustração via OpenAI (`OPENAI_API_KEY` não configurada
  no ambiente de build).
- Um passe visual em viewport mobile real (375/414px) — a revisão de
  responsividade foi feita por leitura de código, já que as páginas
  dependem de dados do Supabase em tempo de request.

`npm audit` acusa vulnerabilidades conhecidas no Next.js 14.2.x (mais
recente da linha 14) e no `mercadopago` v2 — ambas exigem upgrade de
major version (Next 15/16, mercadopago v3) para corrigir. Não fiz esse
upgrade agora por ser uma mudança grande o suficiente para merecer um
ciclo de teste dedicado, não algo para encaixar no fim de uma sessão de
implementação. Vale planejar essa atualização logo após o lançamento.
