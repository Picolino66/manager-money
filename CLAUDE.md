# Repository Guidelines

## Regras Globais
- Responda sempre em português.
- **Ao iniciar qualquer tarefa, leia `docs/index.md` (e `docs/.ai/index.json`) para se orientar e identificar os arquivos relevantes antes de qualquer ação.** Ordem: INDEX FIRST → DOCS SECOND → CODE LAST.
- Antes de alterar arquivos, apresente plano objetivo: escopo, resultado esperado e impacto; aguarde aprovação explícita.
- Atualize `CLAUDE.md`, `AGENTS.md` e `README.md` quando a mudança exigir; `CLAUDE.md` e `AGENTS.md` têm o mesmo conteúdo.
- `CLAUDE.md`, `AGENTS.md` e `README.md` devem ter até 300 linhas; compacte se necessário.
- Nunca versionar segredos; use `.env` (não versionado) e `.env.example` **dentro de cada projeto** (`app/.env`, `client/.env`). Sem `EXPO_PUBLIC_SUPABASE_*` o app roda em modo local; o client exige `VITE_SUPABASE_*`. `service_role` nunca em frontend.
- Nunca faça git commit, git add e git push

## Skills Obrigatórias
- **Toda tarefa de desenvolvimento ou evolução do sistema deve usar `autonomous-software-orchestrator`.** Ela orquestra o ciclo em 7 fases (F1 Discovery → F2 Arquitetura → F3 Contratos → F4 UX/Planejamento → F5 Engenharia → F6 Qualidade/Deploy → F7 Operação) com quality gates, ADRs e snapshots de estado (O1–O7, em `.orchestrator/`). Modos: `full-pipeline`, `phase-resume`, `feature-evolution` (novas features, F4–F7), `architecture-review`, `incident-response`. O contexto compartilhado fica em `.orchestrator/context.json`; seções congeladas por snapshot só mudam via ADR de override. Aciona as demais skills como sub-skills.
- Telas, componentes, navegação e design (`app/src/screens`, `app/src/components`, `app/src/navigation`, `app/src/design`): usar `react-native-expo-architect`.
- Client web (`client/`): agente `agents/web-engineer.md`; UI com `shadcn-ui-specialist`/`ui-light-dark-designer`, rotas com `react-router-specialist`, gráficos com `dataviz`.
- Migrations, RLS e segurança: usar `defensive-security-auditor` ou `fullstack-security-guardian` quando houver auditoria; procedimento em `skills/criar-migration-supabase.md`.
- Documentação, `/docs`, índice IA ou sincronização código-docs: usar `ai-docs-self-healing` e `skills/atualizar-knowledge-layer.md`.
- Nova regra de negócio: seguir `skills/adicionar-regra-de-negocio.md`.

## Estrutura do repositório (ADR-019)
- `app/` = aplicativo mobile Expo (projeto npm independente) · `client/` = aplicação web (P0 implementado; React + Vite SPA, **sempre online, sem sync**: lê do Supabase, aplica caso de uso do núcleo e grava só os registros `dirty`; plano em `docs/architecture/client-web-plan.md`, ADR-020) · `packages/core/` = núcleo compartilhado (`@manager-money/core`, ADR-022) · `supabase/` = backend compartilhado, fonte única (nunca duplicar migrations nos apps) · raiz = workspace do produto (docs, specs, tasks, adr, agents, skills, scripts, CI).
- **npm workspaces** (ADR-022): `packages/*`, `app`, `client`; lockfile único na raiz (`npm ci` na raiz). Sem Turborepo/Nx. Caminhos `code:` nos docs são relativos à raiz (`app/src/...`, `packages/core/src/...`, `client/src/...`).

## Documentação IA-First
- Trate `docs/` como fonte primária; `docs/modules/<módulo>/index.md` mapeia a implementação. Leia o índice do módulo antes do código.
- Precedência em conflito: código executável e contratos > ADRs (`adr/`) > `.orchestrator/context.json` > Markdown em `docs/` > `docs/.ai` (derivado, nunca editar à mão).
- Fontes canônicas: negócio em `docs/business/` (regras `BR-*` em `business-rules.md`), contratos em `docs/architecture/contracts.md`, UX em `docs/flows/` e `docs/design/`, qualidade em `docs/quality/`, operação em `docs/operations/`.
- Fluxo: spec em `specs/` (`SPEC-*`) → task em `tasks/` (`backlog/` → `todo/` → `doing/` → `done/`). Não crie task sem spec.
- Mudou código coberto por um doc (campo `code:` do frontmatter)? Atualize o doc e rode `npm run docs:index`; `docs:check` falha no CI se divergir.
- Preserve IDs (`BR-`, `SPEC-`, `ADR-`, `DEF-`); nunca renumere nem reutilize. Decisão arquitetural vira ADR.
- Papéis de agentes em `agents/` (mobile-engineer, sync-engineer, qa-engineer, docs-keeper).

## Comandos
- **Na raiz:** `npm install`/`npm ci` (todos os projetos); `npm run verify:core|verify:app|verify:client`.
- **Em `app/`:** `npm start` (expo), `npm run android|ios`, `npm run lint` (max-warnings=0), `npm run typecheck`, `npm test`, `npx jest <caminho> -t "<nome>"`, `npm run format` (Prettier da raiz: aspas simples, trailing comma, largura 100).
- **Em `app/`:** `npm run verify` = lint + typecheck + testes com cobertura (≥ 80%).
- **Em `packages/core/`:** `npm run verify` (lint de núcleo puro + typecheck + Vitest ≥ 80%).
- **Em `client/`:** `npm run dev` (5173), `npm run build` + `npm run preview` (4173, com CSP), `npm run verify` (lint + typecheck + Vitest ≥ 80%), `npm run test:e2e` (Playwright, só local).
- **Na raiz:** `npm run docs:index`, `npm run docs:check` (knowledge layer) e `npm run test:db` (migrations + RLS em Postgres 15 descartável, requer Docker). Supabase CLI roda na raiz; `expo`/`eas` em `app/`.

## Arquitetura
- Monólito modular no cliente (Expo SDK 57, RN 0.86, React 19.2, TS 6 estrito) + Supabase (Auth e-mail + senha, sem envio de e-mail — ADR-011; Postgres com RLS). Offline-first.
- Núcleo em `packages/core/src/`: `domain/financial` (cálculos puros) → `application` (casos de uso `(estado, comando, agora) → estado`, seletores) → `contract` (DTOs, mappers, `collectDirty`, erros). Nunca reimplementar regra fora do núcleo.
- Mobile em `app/src/`: `infrastructure` (`storage/`, `sync/`, `supabase/`, `export/`, `monitoring/`) → `store` (Zustand: caso de uso → persiste → agenda sync) → UI.
- Web em `client/src/`: `features` → `store` (caso de uso → grava na hora) → `infrastructure` (Supabase). Telas não importam Supabase/infraestrutura; nada financeiro no navegador.
- Lint proíbe o núcleo de importar React, React Native, AsyncStorage ou Supabase; no client, proíbe `dangerouslySetInnerHTML` e `localStorage` fora da preferência de tema.
- Evite refactors amplos junto com mudanças funcionais.

## Dinheiro e datas
- Valores monetários **sempre em centavos inteiros** (BR-FIN-001); nunca ponto flutuante em cálculo de domínio. Formatação em `packages/core/src/utils/currency.ts`.
- Ciclo financeiro ancorado no dia de pagamento configurável (1–28); datas em `packages/core/src/utils/date.ts` (date-fns). Superávit não é transferido; dívida é herdada (BR-FIN-005/006).
- Cartão: a fatura pesa no ciclo do **vencimento**; limite do cartão nunca é dinheiro disponível; fixas pendentes ficam reservadas (ADR-017, BR-FIN-004/025/026).
- Fatura: pagar uma fatura já reservada **não desconta de novo** (só encargos pesam); o limite libera **só o amortizado**; o restante de pagamento parcial vira **dívida do próximo ciclo** (ADR-018, BR-FIN-026/033/034; invariantes INV-01..10 em BR-FIN-030).
- Textos de UI em português.
- Cores sempre pelo tema ativo (ADR-021): `makeStyles((colors) => ...)` + `useStyles()` ou `useTheme()`; nunca cor literal nem `colors` estático. Preferência de tema fica só no aparelho, fora do documento sincronizado. No web: tokens com os mesmos nomes como variáveis CSS (`client/src/styles/index.css`, paridade testada) e classes Tailwind.

## Persistência local e Sync
- Documento local único versionado (v8) em `app/src/infrastructure/storage/`; mudança de esquema exige migração em `migrations.ts` e atualização de `schema.ts`.
- Sync offline-first: outbox + pull incremental em `app/src/infrastructure/sync/sync-engine.ts`; `memory-remote.ts` é o remoto fake para testes. Falha de rede nunca perde pendência (retry com backoff).
- Sessão Supabase armazenada criptografada (`app/src/infrastructure/supabase/session-storage.ts`); nunca logar tokens, e-mails ou valores (use `monitoring/logger.ts`).

## Banco (Supabase)
- Migrations SQL versionadas em `supabase/migrations/` (nome `YYYYMMDDHHMMSS_*.sql`), aplicadas via `supabase db push`; nunca editar migration já aplicada, crie nova.
- Toda tabela com RLS; alterações cobertas em `supabase/tests/rls.plain.sql` e validadas com `npm run test:db` (raiz).
- Exclusão de conta via RPC `delete_my_account()`; contratos em `docs/architecture/contracts.md`.

## Testes e Qualidade
- Testes `*.test.ts(x)` ao lado do código: Jest (`jest-expo`) no app; Vitest no core e no client (Testing Library; Playwright E2E local). Cobertura ≥ 80%: core inteiro; app em infrastructure e store; client em store, infrastructure e lib.
- Adicione regressão ao alterar regra de negócio, caso de uso, migração de documento, sync ou RLS.
- CI (`.github/workflows/ci.yml`): `npm ci` na raiz; jobs `core` (verify), `app` (verify, `expo config`, audit), `client` (lint, typecheck, test:coverage, build, audit), `docs`, banco e gitleaks. Mudou `packages/core`? Rode `verify` do app e do client.

## Commits e PRs
- Mensagens curtas em português, Conventional Commits (`feat:`, `fix:`, `docs(f6):`).
- PR cita spec/task relacionada, regras `BR-*` afetadas, migrations/`.env`, comandos executados e capturas em mudança visual.
- Não misture mudanças não relacionadas no mesmo commit.

## Colaboração
- Em impacto funcional, registre evidências mínimas de validação na task correspondente.
- Entre velocidade e segurança, priorize previsibilidade e rastreabilidade.
