# ADR-020 — Client web: stack (React + Vite SPA), acesso online direto ao Supabase e núcleo compartilhado

- **Status:** ACCEPTED (2026-10-04, aprovação do plano de execução do P0 — T-032) · **Fase:** F2 (evolução) · **Data:** 2026-10-04
- **Depende de:** [ADR-019](ADR-019-estrutura-do-repositorio-app-client-supabase.md),
  [ADR-001](ADR-001-padrao-arquitetural.md), [ADR-004](ADR-004-sincronizacao.md),
  [ADR-006](ADR-006-modelo-de-seguranca.md), [ADR-011](ADR-011-autenticacao-email-senha.md).
- **Spec:** [SPEC-020](../specs/SPEC-020-reorganizacao-do-repositorio-e-plano-do-client.md) · plano completo:
  [client-web-plan](../docs/architecture/client-web-plan.md).
- Extração do núcleo detalhada na [ADR-022](ADR-022-nucleo-compartilhado-packages-core.md); spec do MVP:
  [SPEC-022](../specs/SPEC-022-client-web-mvp.md).

## Contexto

Todas as regras financeiras rodam **no cliente**, sobre o documento local
(`app/src/domain`, `app/src/application`). O Supabase é réplica de sincronização (upsert por registro,
LWW, pull incremental — ADR-004): não há RPCs de negócio, só `delete_my_account()`. O servidor garante
forma (checks, FKs, um ciclo ativo, RLS), não semântica (abrir/fechar ciclo, faturas, limite, dívida
herdada — INV-01..10).

Consequência: um client web que gravasse nas tabelas sem as mesmas regras quebraria invariantes.
O web precisa usar **o mesmo núcleo** (domínio + aplicação + contrato/mappers).

Decisão do dono do produto (2026-10-04): o web **não sincroniza** — lê e grava direto no Supabase,
sempre online. O sync offline-first continua exclusivo do mobile, que salva localmente.

## Opções consideradas

| Tema | Opção | Prós | Contras |
|---|---|---|---|
| Framework | **React + Vite (SPA)** | Estático, sem servidor; o núcleo puro roda no browser como no mobile; DX e testes (Vitest) simples; mesma linguagem/React do app | Sessão do Supabase no `localStorage` (exposta a XSS) — mitigada por CSP estrita |
| Framework | Next.js (App Router) | Cookies httpOnly via `@supabase/ssr`; SSR | Tudo fica atrás de login (sem SEO); o núcleo calcula sobre o documento inteiro no cliente — SSR não tem o que renderizar sem duplicar a lógica no servidor; runtime de servidor, server actions e mais superfície de ataque |
| Dados | Web como mais um aparelho (motor de sync, outbox, cache) | Reaproveita o sync do mobile | Complexidade offline sem necessidade no desktop; dados financeiros no navegador |
| Dados | **Online direto: ler tudo → caso de uso do núcleo → upsert imediato dos alterados** | Simples; nada financeiro no navegador; servidor é a verdade | Sem offline; ação com vários registros pode falhar no meio (mitigação: ordem de dependência + recarregar) |
| Dados | Consultas e escritas PostgREST por tela, sem núcleo | Simples para leitura | Reimplementa cálculos e regras — divergência garantida |
| Compartilhamento | **`packages/core` + npm workspaces** (na fundação do client) | Fonte única de regras; app e client testam o mesmo código | Ajuste no Metro/Jest do app |
| Compartilhamento | Importar `../app/src/...` por alias | Nada a extrair | Acoplamento a caminhos internos do app; quebra o lint de camadas |

## Decisão

- **React 19 + Vite + TypeScript estrito, SPA**, React Router, Zustand, React Hook Form + Zod
  (mesmas libs do app), Tailwind + shadcn/ui (Radix, acessível), TanStack Table, Recharts.
- **Online direto, sem sync:** ao entrar, lê as linhas do usuário e monta o estado em memória com os
  `mappers`; cada ação aplica o caso de uso compartilhado e grava na hora só os registros alterados.
  Falha = ação não aplicada + erro na tela. Sem outbox, cache ou modo local; permite criar conta.
- **Extrair `packages/core`** (domain, application, utils de data/moeda, `types.ts` + `mappers.ts`) com npm
  workspaces, como tarefa da fundação do client (CLIENT-003), sob ADR própria e sem mudar o app.
  O motor de sync fica no app.
- **RLS continua sendo a fronteira de segurança.** O client usa só a anon key + JWT do usuário.
- Uso local por enquanto; no futuro, build estático numa VPS própria (Nginx/Caddy).
- Temas claro e escuro desde o início ([ADR-021](ADR-021-tema-claro-e-escuro.md)).

## Consequências

- Nenhuma mudança de schema é necessária para o MVP do client.
- `CONTRACT_VERSION` passa a ser lido pelos dois clientes a partir do mesmo pacote.
- Edições do web chegam ao mobile no próximo sync dele; conflitos seguem LWW (ADR-004).
- Como o web atualiza na hora e o mobile depende das lojas, mudanças de contrato precisam continuar
  aditivas (ADR-008) e o web não pode gravar campos que versões antigas do app descartem sem querer.
