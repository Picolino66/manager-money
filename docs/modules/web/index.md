---
id: web
type: module
module: web
title: Client web
summary: >
  Aplicação web (React + Vite SPA) sempre online: lê o estado do usuário do Supabase, aplica os
  casos de uso do núcleo e grava na hora só os registros alterados; sem sync nem dados no navegador.
code:
  - client/package.json
  - client/vite.config.ts
  - client/eslint.config.js
  - client/src/router.tsx
last_verified_commit: 7903717+T-041b
---

# Módulo: client web

Specs [SPEC-022](../../../specs/SPEC-022-client-web-mvp.md) e [SPEC-023](../../../specs/SPEC-023-client-web-ajustes.md) · plano
[client-web-plan](../../architecture/client-web-plan.md) · [ADR-020](../../../adr/ADR-020-client-web-stack-e-integracao.md).

| Feature | Rota | Doc |
|---|---|---|
| `web.auth` | `/login` | [auth.md](auth.md) |
| `web.onboarding` | `/comecar` | [onboarding.md](onboarding.md) |
| `web.shell` | layout, tema, 404 | [shell.md](shell.md) |
| `web.overview` | `/` | [overview.md](overview.md) |
| `web.expenses` | `/gastos` | [expenses.md](expenses.md) |
| `web.cycles` | `/ciclos`, `/ciclos/:id` | [cycles.md](cycles.md) |
| `web.analysis` | `/analise` | [analysis.md](analysis.md) |
| `web.settings` | `/ajustes`, `/ajustes/configuracao`, `/ajustes/exportar` | [settings.md](settings.md) |
| `web.cards` | `/ajustes/cartoes`, `/ajustes/cartoes/:id`, `/ajustes/cartoes/:id/compras-anteriores` | [cards.md](cards.md) |

## Camadas (`client/src`)

`features/` (telas) → `store/` (Zustand: sessão, dados, tema) → `infrastructure/` (Supabase, repositório,
auth, logger) → `@manager-money/core`. `lib/` guarda view models puros (testados contra o núcleo).
Lint: telas não importam Supabase, `infrastructure` nem o contrato; `dangerouslySetInnerHTML` proibido;
`localStorage` só em `theme-preference.ts`.

## Fluxo de dados (sem sync)

1. **Ler:** `loadUserState` busca as linhas vivas das 9 tabelas (paginado, 1000 por página), monta o
   `LocalState` com os mappers, recalcula o saldo do ciclo ativo em memória e zera as marcações.
2. **Agir:** `data.store.run(casoDeUso)` recarrega → aplica o caso de uso → `saveChanges` grava, tabela a
   tabela na ordem de `SYNC_TABLES`, só o que `collectDirty` devolve.
3. **Falhar:** o estado anterior fica na tela e o erro aparece; se alguma tabela já foi gravada ou o
   servidor recusou o ciclo ativo duplicado (`23505`), recarrega do servidor. JWT expirado → refresh;
   se falhar, volta ao login com aviso.

Conta criada no web chega ao mobile pelo fluxo de primeiro login (BR-ACC-002); edições do web chegam ao
mobile no próximo pull; o web vê as do mobile ao recarregar (cada ação também recarrega antes).
