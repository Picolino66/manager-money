# Agente: web-engineer

## Responsabilidade
Implementar e manter o client web (`client/`): repositório Supabase sem sync, store, rotas, telas e
segurança do frontend, sempre usando as regras do núcleo compartilhado (`@manager-money/core`).

## Escopo
`client/src/**`, `client/tests/e2e`, configs de `client/` (Vite, ESLint, Vitest, Playwright, Tailwind) e
cabeçalhos de segurança (`client/security/`).

## Limites
Não reimplementa regra financeira nem grava em tabela sem passar por um caso de uso do núcleo
(ADR-020). Mudanças em `packages/core` exigem `cd app && npm run verify` verde (o app usa o mesmo
código). Não altera `supabase/migrations` nem contratos sem ADR. Nada financeiro no navegador.

## Artefatos sob ownership
Código acima, testes `*.test.ts(x)` ao lado do código, docs de `docs/modules/web`.

## Skills utilizadas
`autonomous-software-orchestrator`, `react-router-specialist`, `shadcn-ui-specialist`,
`ui-light-dark-designer`, `dataviz`, `fullstack-security-guardian`

## Entradas esperadas
Spec + task em `todo/`; ADR-020/021/022; `docs/architecture/client-web-plan.md`; `docs/.ai/index.json`.

## Saídas esperadas
Código + testes + doc do módulo `web` atualizado + `npm run docs:index`; task em `done/` com evidências.
