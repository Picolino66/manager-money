# Manager Money

Produto de finanças pessoais. O app mobile (Android e iOS) transforma a renda mensal em um **limite diário de gastos**, recalculado
a cada gasto dentro do ciclo do seu dia de pagamento. Funciona offline; o login com e-mail e senha
é opcional e habilita a sincronização entre aparelhos. O **client web** (desktop) mostra o todo e
administra o histórico com a mesma conta e as mesmas regras, sempre online.

## Funcionalidades

- Ciclo financeiro alinhado ao **dia de pagamento configurável** (1–28)
- Limite diário dinâmico, status do dia e histórico por dia
- Despesas fixas (pendentes ficam reservadas no ciclo), meta de economia e rendas avulsas
- Cartões de crédito: compras parceladas, **faturas** que pesam no ciclo do vencimento, **limite do cartão**
  separado do dinheiro disponível, pagamento total ou parcial da fatura (restante vira dívida do próximo ciclo),
  encargos e situação inicial (total da fatura e parcelamentos anteriores ao app)
- Próximos compromissos e **projeção** dos próximos ciclos ("livre antes de novos gastos")
- "Já recebi": abre o próximo ciclo quando a renda cai antes do dia
- Gastos por categoria e período, com gráfico
- Conta opcional (e-mail e senha), **sync offline-first**, exportação JSON e exclusão de conta

## Stack

- **Mobile:** Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript 6 estrito · Zustand · React Hook Form + Zod · Jest.
- **Web:** React 19.2 + Vite (SPA) · React Router · Tailwind + componentes Radix (padrão shadcn/ui) · TanStack Table ·
  Recharts · Vitest + Testing Library + Playwright.
- **Núcleo compartilhado** (`packages/core`): domínio, casos de uso e contrato em TS puro · date-fns · Vitest.
- **Backend:** Supabase (Auth + Postgres com RLS). Valores monetários sempre em centavos.

## Estrutura

| Pasta | O que é |
|---|---|
| [`packages/core/`](packages/core) | núcleo compartilhado: regras financeiras, casos de uso e contrato remoto (ADR-022) |
| [`app/`](app) | aplicativo mobile (Expo) |
| [`client/`](client) | aplicação web — P0 implementado, uso local ([README](client/README.md), [plano](docs/architecture/client-web-plan.md)) |
| [`supabase/`](supabase) | backend compartilhado: migrations e testes de RLS |
| raiz | documentação, specs, tasks, ADRs, scripts da knowledge layer e CI |

npm workspaces: instale **uma vez na raiz** (`npm install` ou `npm ci`); o lockfile é único.

## Como rodar (app mobile)

```bash
npm install                 # na raiz
cd app
cp .env.example .env        # opcional: preencha para habilitar o sync
npx expo start
```

Para abrir no celular, leia o QR code com o **Expo Go** (versão do SDK 57, a atual das lojas).

Sem as variáveis `EXPO_PUBLIC_SUPABASE_*`, o app roda em **modo local** (tudo funciona, sem sync).

## Como rodar (client web)

```bash
npm install                 # na raiz
cd client
cp .env.example .env        # VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (mesmo projeto do app)
npm run dev                 # http://localhost:5173
npm run build && npm run preview   # build com os cabeçalhos de segurança, http://localhost:4173
```

## Qualidade

```bash
npm run verify:core        # (raiz) núcleo: lint + typecheck + Vitest (≥ 80%)
npm run verify:app         # (raiz) app: lint + typecheck + Jest com cobertura (≥ 80%)
npm run verify:client      # (raiz) web: lint + typecheck + Vitest com cobertura (≥ 80%)
cd client && npm run test:e2e   # E2E local (Playwright)
npm run docs:check         # (raiz) valida a knowledge layer
npm run test:db            # (raiz) migrations + RLS em Postgres descartável (requer Docker)
npm run docs:index         # (raiz) regenera docs/.ai após mudar documentação
```

## Documentação

Comece por [docs/index.md](docs/index.md). Decisões em [adr/](adr/README.md), comportamento em
[specs/](specs/README.md), execução em [tasks/](tasks/README.md).

```
packages/core/src/domain          regras financeiras puras
packages/core/src/application     casos de uso e seletores puros sobre o estado do usuário
packages/core/src/contract        DTOs das linhas, mappers, registros alterados, erros
app/src/infrastructure  storage local, sync, Supabase, exportação, monitoramento
app/src/store           Zustand (composição)
app/src/screens|components|navigation|design   interface
client/src              web: features (telas) → store → infrastructure (Supabase, sem sync)
supabase/               migrations SQL e testes de RLS (compartilhado por app e client)
```
