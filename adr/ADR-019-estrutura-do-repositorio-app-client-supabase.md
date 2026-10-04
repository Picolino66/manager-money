# ADR-019 — Estrutura do repositório: `app/`, `client/` e `supabase/` compartilhado

- **Status:** ACCEPTED · **Fase:** F2 (evolução) · **Data:** 2026-10-04
- **Sobrepõe:** `.orchestrator/context.json → scope.excluded` ("web" deixa de ser excluído: o client web
  passa a ser planejado; implementação em tarefa posterior — ver [ADR-020](ADR-020-client-web-stack-e-integracao.md)).
- **Atualiza:** [ADR-009](ADR-009-estrutura-agentic.md) (gate `docs:check` passa a rodar na raiz) e
  [ADR-010](ADR-010-testes-e-qualidade.md) (`verify` do app não inclui mais `docs:check`).
- **Spec:** [SPEC-020](../specs/SPEC-020-reorganizacao-do-repositorio-e-plano-do-client.md).

## Contexto

O repositório nasceu como um único projeto Expo na raiz: `package.json`, configs, `src/` e `assets/`
conviviam com o backend (`supabase/`) e com a camada agentic (`docs/`, `adr/`, `specs/`, `tasks/`,
`agents/`, `skills/`, `.orchestrator/`). O produto vai ganhar uma aplicação web. Mantido como estava,
o client teria de morar dentro do projeto mobile ou disputar a raiz com ele, e o `supabase/` pareceria
subordinado ao app.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Manter o app na raiz e criar `web/` ao lado | Zero movimentação | Raiz ambígua (configs do Expo valem para quem?); assimetria entre apps |
| **`app/` + `client/` + `supabase/` na raiz, projetos npm independentes** | Fronteiras claras; cada app roda com `cd <app> && npm ci`; sem ferramenta nova | Movimentação única de arquivos; caminhos `code:` dos docs mudam |
| npm/pnpm workspaces já agora | Prepara compartilhamento de código | Nada a compartilhar ainda (o client não existe); muda o fluxo de instalação do app sem ganho |
| Turborepo / Nx | Cache e orquestração de tarefas | Complexidade desproporcional para 2 apps e 1 dev |

## Decisão

```
manager-money/
├── app/        aplicativo mobile (Expo) — projeto npm independente
├── client/     aplicação web (placeholder; plano em docs/architecture/client-web-plan.md)
├── supabase/   backend compartilhado: migrations, testes de RLS (fonte única)
├── scripts/    ferramentas do repositório (knowledge layer)
├── docs/ adr/ specs/ tasks/ agents/ skills/ .orchestrator/   camada agentic do produto
├── .github/    CI do repositório (jobs por projeto)
└── package.json   mínimo, sem dependências: docs:index, docs:check, test:db
```

- **Sem ferramenta de monorepo e sem workspaces** por enquanto. Reavaliar quando houver código
  compartilhado real (ver ADR-020: extração de `packages/core` na fundação do client).
- Configurações compartilhadas na raiz: `.gitignore`, `.prettierrc.json` (o Prettier sobe diretórios
  até achar a config), `.codex`.
- Variáveis de ambiente ficam no projeto que as consome: `app/.env` (`EXPO_PUBLIC_*`, lido pelo Expo
  na pasta do projeto). O client terá `client/.env` próprio; segredos de servidor nunca ficam em
  projetos de frontend (ADR-006).
- Comandos do Supabase CLI (`supabase link`, `db push`) rodam na raiz; `expo`/`eas` rodam em `app/`.
- O campo `code:` do frontmatter dos docs é relativo à raiz (`app/src/...`).

## Trade-offs e consequências

- O `verify` do app deixa de incluir `docs:check`; o CI ganha um job `docs` na raiz. Localmente, a
  validação completa é `cd app && npm run verify` + `npm run docs:check` na raiz.
- Specs e tasks concluídas mantêm os caminhos antigos (`src/...`) como registro histórico.
- O EAS envia o repositório git inteiro e compila a partir de `app/` (suportado nativamente).
- Histórico git: arquivos foram movidos (não recriados); o git detecta as renomeações no commit.
