# Manager Money

App mobile (Android e iOS) que transforma a renda mensal em um **limite diário de gastos**, recalculado
a cada gasto dentro do ciclo do seu dia de pagamento. Funciona offline; o login com e-mail e senha
é opcional e habilita a sincronização entre aparelhos.

## Funcionalidades

- Ciclo financeiro alinhado ao **dia de pagamento configurável** (1–28)
- Limite diário dinâmico, status do dia e histórico por dia
- Despesas fixas, **parcelamentos** no cartão e meta de economia
- "Já recebi": abre o próximo ciclo quando a renda cai antes do dia
- Gastos por categoria e período, com gráfico
- Conta opcional (e-mail e senha), **sync offline-first**, exportação JSON e exclusão de conta

## Stack

Expo SDK 54 · React Native 0.81 · TypeScript estrito · Zustand · React Hook Form + Zod · date-fns ·
Supabase (Auth + Postgres com RLS) · Jest. Valores monetários sempre em centavos.

## Como rodar

```bash
npm install
cp .env.example .env.local   # opcional: preencha para habilitar o sync
npx expo start
```

Sem as variáveis `EXPO_PUBLIC_SUPABASE_*`, o app roda em **modo local** (tudo funciona, sem sync).

## Qualidade

```bash
npm run verify      # lint + typecheck + testes com cobertura (≥ 80%) + knowledge layer
npm run test:db     # migrations + RLS em Postgres descartável (requer Docker)
npm run docs:index  # regenera docs/.ai após mudar documentação
```

## Documentação

Comece por [docs/index.md](docs/index.md). Decisões em [adr/](adr/README.md), comportamento em
[specs/](specs/README.md), execução em [tasks/](tasks/README.md).

```
src/domain          regras financeiras puras
src/application     casos de uso puros sobre o documento local
src/infrastructure  storage local, sync, Supabase, exportação, monitoramento
src/store           Zustand (composição)
src/screens|components|navigation|design   interface
supabase/           migrations SQL e testes de RLS
```
