# Repository Guidelines

## Regras Globais
- Responda sempre em português.
- **Ao iniciar qualquer tarefa, leia `docs/index.md` (e `docs/.ai/index.json`) para se orientar e identificar os arquivos relevantes antes de qualquer ação.** Ordem: INDEX FIRST → DOCS SECOND → CODE LAST.
- Antes de alterar arquivos, apresente plano objetivo: escopo, resultado esperado e impacto; aguarde aprovação explícita.
- Atualize `CLAUDE.md`, `AGENTS.md` e `README.md` quando a mudança exigir; `CLAUDE.md` e `AGENTS.md` têm o mesmo conteúdo.
- `CLAUDE.md`, `AGENTS.md` e `README.md` devem ter até 300 linhas; compacte se necessário.
- Nunca versionar segredos; use `.env.local` (não versionado) e `.env.example`. Sem `EXPO_PUBLIC_SUPABASE_*` o app roda em modo local.

## Skills Obrigatórias
- **Toda tarefa de desenvolvimento ou evolução do sistema deve usar `autonomous-software-orchestrator`.** Ela orquestra o ciclo em 7 fases (F1 Discovery → F2 Arquitetura → F3 Contratos → F4 UX/Planejamento → F5 Engenharia → F6 Qualidade/Deploy → F7 Operação) com quality gates, ADRs e snapshots de estado (O1–O7, em `.orchestrator/`). Modos: `full-pipeline`, `phase-resume`, `feature-evolution` (novas features, F4–F7), `architecture-review`, `incident-response`. O contexto compartilhado fica em `.orchestrator/context.json`; seções congeladas por snapshot só mudam via ADR de override. Aciona as demais skills como sub-skills.
- Telas, componentes, navegação e design (`src/screens`, `src/components`, `src/navigation`, `src/design`): usar `react-native-expo-architect`.
- Migrations, RLS e segurança: usar `defensive-security-auditor` ou `fullstack-security-guardian` quando houver auditoria; procedimento em `skills/criar-migration-supabase.md`.
- Documentação, `/docs`, índice IA ou sincronização código-docs: usar `ai-docs-self-healing` e `skills/atualizar-knowledge-layer.md`.
- Nova regra de negócio: seguir `skills/adicionar-regra-de-negocio.md`.

## Documentação IA-First
- Trate `docs/` como fonte primária; `docs/modules/<módulo>/index.md` mapeia a implementação. Leia o índice do módulo antes do código.
- Precedência em conflito: código executável e contratos > ADRs (`adr/`) > `.orchestrator/context.json` > Markdown em `docs/` > `docs/.ai` (derivado, nunca editar à mão).
- Fontes canônicas: negócio em `docs/business/` (regras `BR-*` em `business-rules.md`), contratos em `docs/architecture/contracts.md`, UX em `docs/flows/` e `docs/design/`, qualidade em `docs/quality/`, operação em `docs/operations/`.
- Fluxo: spec em `specs/` (`SPEC-*`) → task em `tasks/` (`backlog/` → `todo/` → `doing/` → `done/`). Não crie task sem spec.
- Mudou código coberto por um doc (campo `code:` do frontmatter)? Atualize o doc e rode `npm run docs:index`; `docs:check` falha no CI se divergir.
- Preserve IDs (`BR-`, `SPEC-`, `ADR-`, `DEF-`); nunca renumere nem reutilize. Decisão arquitetural vira ADR.
- Papéis de agentes em `agents/` (mobile-engineer, sync-engineer, qa-engineer, docs-keeper).

## Comandos
- `npm install`, `npm start` (expo), `npm run android|ios`.
- `npm run lint` (max-warnings=0), `npm run typecheck`, `npm test`, `npx jest <caminho> -t "<nome>"`.
- `npm run verify` = lint + typecheck + testes com cobertura (≥ 80%) + `docs:check`; é o gate do CI.
- `npm run test:db`: migrations + RLS em Postgres 15 descartável (requer Docker).
- `npm run format` (Prettier: aspas simples, trailing comma, largura 100).

## Arquitetura
- Monólito modular no cliente (Expo SDK 54, RN 0.81, TS estrito) + Supabase (Auth e-mail + senha, sem envio de e-mail — ADR-011; Postgres com RLS). Offline-first.
- Camadas em `src/`: `domain/financial` (cálculos puros) → `application` (casos de uso `(estado, comando, agora) → estado`) → `infrastructure` (`storage/`, `sync/`, `supabase/`, `export/`, `monitoring/`) → `store` (Zustand: caso de uso → persiste → agenda sync) → UI.
- Lint (`import/no-restricted-paths`) proíbe `domain` e `application` de importar React, React Native, AsyncStorage ou Supabase.
- Evite refactors amplos junto com mudanças funcionais.

## Dinheiro e datas
- Valores monetários **sempre em centavos inteiros** (BR-FIN-001); nunca ponto flutuante em cálculo de domínio. Formatação em `src/utils/currency.ts`.
- Ciclo financeiro ancorado no dia de pagamento configurável (1–28); datas em `src/utils/date.ts` (date-fns). Superávit não é transferido; dívida é herdada (BR-FIN-005/006).
- Textos de UI em português.

## Persistência local e Sync
- Documento local único versionado (v2) em `src/infrastructure/storage/`; mudança de esquema exige migração em `migrations.ts` e atualização de `schema.ts`.
- Sync offline-first: outbox + pull incremental em `sync/sync-engine.ts`; `memory-remote.ts` é o remoto fake para testes. Falha de rede nunca perde pendência (retry com backoff).
- Sessão Supabase armazenada criptografada (`supabase/session-storage.ts`); nunca logar tokens, e-mails ou valores (use `monitoring/logger.ts`).

## Banco (Supabase)
- Migrations SQL versionadas em `supabase/migrations/` (nome `YYYYMMDDHHMMSS_*.sql`), aplicadas via `supabase db push`; nunca editar migration já aplicada, crie nova.
- Toda tabela com RLS; alterações cobertas em `supabase/tests/rls.plain.sql` e validadas com `npm run test:db`.
- Exclusão de conta via RPC `delete_my_account()`; contratos em `docs/architecture/contracts.md`.

## Testes e Qualidade
- Jest (`jest-expo`); testes `*.test.ts(x)` ao lado do código. Cobertura global ≥ 80% sobre domain, application, infrastructure, utils e store.
- Adicione regressão ao alterar regra de negócio, caso de uso, migração de documento, sync ou RLS.
- CI (`.github/workflows/ci.yml`): `verify`, `npm audit --audit-level=critical` e job de banco.

## Commits e PRs
- Mensagens curtas em português, Conventional Commits (`feat:`, `fix:`, `docs(f6):`).
- PR cita spec/task relacionada, regras `BR-*` afetadas, migrations/`.env`, comandos executados e capturas em mudança visual.
- Não misture mudanças não relacionadas no mesmo commit.

## Colaboração
- Em impacto funcional, registre evidências mínimas de validação na task correspondente.
- Entre velocidade e segurança, priorize previsibilidade e rastreabilidade.
