# ADR-020 — Client web: stack (React + Vite SPA) e integração pelo núcleo compartilhado

- **Status:** PROPOSED · **Fase:** F2 (evolução) · **Data:** 2026-10-04
- **Depende de:** [ADR-019](ADR-019-estrutura-do-repositorio-app-client-supabase.md),
  [ADR-001](ADR-001-padrao-arquitetural.md), [ADR-004](ADR-004-sincronizacao.md),
  [ADR-006](ADR-006-modelo-de-seguranca.md), [ADR-011](ADR-011-autenticacao-email-senha.md).
- **Spec:** [SPEC-020](../specs/SPEC-020-reorganizacao-do-repositorio-e-plano-do-client.md) · plano completo:
  [client-web-plan](../docs/architecture/client-web-plan.md).
- Vira ACCEPTED quando a fundação do client (CLIENT-001..005) for aprovada para execução.

## Contexto

Todas as regras financeiras rodam **no cliente**, sobre o documento local
(`app/src/domain`, `app/src/application`). O Supabase é réplica de sincronização (upsert por registro,
LWW, pull incremental — ADR-004): não há RPCs de negócio, só `delete_my_account()`. O servidor garante
forma (checks, FKs, um ciclo ativo, RLS), não semântica (abrir/fechar ciclo, faturas, limite, dívida
herdada — INV-01..10).

Consequência: um client web que gravasse direto nas tabelas sem as mesmas regras quebraria invariantes.
O web precisa usar **o mesmo núcleo** (domínio + aplicação + mappers + motor de sync), como se fosse mais
um aparelho do usuário.

## Opções consideradas

| Tema | Opção | Prós | Contras |
|---|---|---|---|
| Framework | **React + Vite (SPA)** | Estático, sem servidor; o núcleo puro roda no browser como no mobile; DX e testes (Vitest) simples; mesma linguagem/React do app | Sessão do Supabase no `localStorage` (exposta a XSS) — mitigada por CSP estrita |
| Framework | Next.js (App Router) | Cookies httpOnly via `@supabase/ssr`; SSR | Tudo fica atrás de login (sem SEO); o núcleo calcula sobre o documento inteiro no cliente — SSR não tem o que renderizar sem duplicar a lógica no servidor; runtime de servidor, server actions e mais superfície de ataque |
| Dados | **Documento em memória via motor de sync compartilhado** | Mesmas regras e mesma resolução de conflito do mobile | Exige extrair o núcleo para um pacote |
| Dados | Consultas PostgREST diretas por tela | Simples para leitura | Reimplementa cálculos (limite diário, faturas, projeção) — divergência garantida |
| Compartilhamento | **`packages/core` + npm workspaces** (na fundação do client) | Fonte única de regras; app e client testam o mesmo código | Ajuste no Metro/Jest do app |
| Compartilhamento | Importar `../app/src/...` por alias | Nada a extrair | Acoplamento a caminhos internos do app; quebra o lint de camadas |

## Decisão (proposta)

- **React 19 + Vite + TypeScript estrito, SPA**, React Router, Zustand, React Hook Form + Zod
  (mesmas libs do app), Tailwind + shadcn/ui (Radix, acessível), TanStack Table, Recharts.
- **Modelo "mais um aparelho":** o web faz login, puxa os dados pelo motor de sync, monta o documento
  em memória, aplica os casos de uso compartilhados e envia o outbox. Sem modo local no web.
- **Extrair `packages/core`** (domain, application, utils de data/moeda, mappers e motor de sync com a
  porta `SyncRemote`) com npm workspaces, como primeira tarefa da fundação do client (CLIENT-003),
  sob ADR própria e sem mudar comportamento do app.
- **RLS continua sendo a fronteira de segurança.** O client usa só a anon key + JWT do usuário.
- Deploy estático (recomendação: Cloudflare Pages; ver plano).

## Consequências

- Nenhuma mudança de schema é necessária para o MVP do client.
- `CONTRACT_VERSION` passa a ser lido pelos dois clientes a partir do mesmo pacote.
- Como o web atualiza na hora e o mobile depende das lojas, mudanças de contrato precisam continuar
  aditivas (ADR-008) e o web não pode gravar campos que versões antigas do app descartem sem querer.
