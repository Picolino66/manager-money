---
spec: SPEC-020
features: [tooling.quality-pipeline, architecture.client-web-plan]
---
# SPEC-020 — Reorganização do repositório (`app/`, `client/`, `supabase/`) e plano do client web

## Objetivo
Separar o aplicativo mobile atual em `app/`, manter `supabase/` na raiz como backend compartilhado,
criar `client/` como placeholder e registrar o plano técnico do client web, **sem mudar comportamento**
do app nem regras de negócio.

## Docs relacionados
[ADR-019](../adr/ADR-019-estrutura-do-repositorio-app-client-supabase.md) ·
[ADR-020](../adr/ADR-020-client-web-stack-e-integracao.md) ·
[client-web-plan](../docs/architecture/client-web-plan.md) ·
[quality-pipeline](../docs/modules/tooling/quality-pipeline.md) · [runbook](../docs/operations/runbook.md)

## Requisitos relacionados
Nenhum RF/BR alterado. RNF de qualidade (cobertura ≥ 80%, lint sem avisos) preservados.

## Regras
- Tudo que pertence só ao app mobile vai para `app/` (código, assets, configs Expo/EAS/TS/ESLint/Jest,
  `package.json`, lockfile, `.env`).
- `supabase/`, `scripts/`, a camada agentic, `.github/`, `.gitignore`, `.prettierrc.json` e `.codex`
  ficam na raiz.
- Comandos transversais (`docs:index`, `docs:check`, `test:db`) ficam num `package.json` mínimo na raiz,
  sem dependências e sem workspaces.
- CI: job `app` com `working-directory: app`; job `docs` na raiz; job `database` e gitleaks inalterados.
- O client **não** é implementado nesta spec; apenas `client/README.md`.

## Critérios de aceite
- Em `app/`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:coverage` (≥ 80%) verdes;
  `npx expo config` e `npx expo-doctor` sem erro; `npx expo export -p android` gera o bundle.
- Na raiz: `npm run docs:check` verde; `npm run test:db` verde quando houver Docker.
- Nenhum arquivo de `app/src/` com conteúdo alterado.
- Plano do client com escopo P0/P1/P2, stack, rotas, segurança, testes, deploy, backlog e fases.
