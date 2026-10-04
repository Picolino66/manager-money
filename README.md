# Manager Money

Produto de finanças pessoais. O app mobile (Android e iOS) transforma a renda mensal em um **limite diário de gastos**, recalculado
a cada gasto dentro do ciclo do seu dia de pagamento. Funciona offline; o login com e-mail e senha
é opcional e habilita a sincronização entre aparelhos.

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

Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript 6 estrito · Zustand · React Hook Form + Zod · date-fns ·
Supabase (Auth + Postgres com RLS) · Jest. Valores monetários sempre em centavos.

## Estrutura

| Pasta | O que é |
|---|---|
| [`app/`](app) | aplicativo mobile (Expo) — projeto npm independente |
| [`client/`](client) | aplicação web — **planejada, sem implementação** ([plano](docs/architecture/client-web-plan.md)) |
| [`supabase/`](supabase) | backend compartilhado: migrations e testes de RLS |
| raiz | documentação, specs, tasks, ADRs, scripts da knowledge layer e CI |

## Como rodar (app mobile)

```bash
cd app
npm install
cp .env.example .env   # opcional: preencha para habilitar o sync
npx expo start
```

Para abrir no celular, leia o QR code com o **Expo Go** (versão do SDK 57, a atual das lojas).

Sem as variáveis `EXPO_PUBLIC_SUPABASE_*`, o app roda em **modo local** (tudo funciona, sem sync).

## Qualidade

```bash
cd app && npm run verify   # lint + typecheck + testes com cobertura (≥ 80%)
npm run docs:check         # (raiz) valida a knowledge layer
npm run test:db            # (raiz) migrations + RLS em Postgres descartável (requer Docker)
npm run docs:index         # (raiz) regenera docs/.ai após mudar documentação
```

## Documentação

Comece por [docs/index.md](docs/index.md). Decisões em [adr/](adr/README.md), comportamento em
[specs/](specs/README.md), execução em [tasks/](tasks/README.md).

```
app/src/domain          regras financeiras puras
app/src/application     casos de uso puros sobre o documento local
app/src/infrastructure  storage local, sync, Supabase, exportação, monitoramento
app/src/store           Zustand (composição)
app/src/screens|components|navigation|design   interface
supabase/               migrations SQL e testes de RLS (compartilhado por app e client)
```
