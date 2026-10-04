---
id: architecture.client-web-plan
type: plan
module: architecture
title: Reorganização do repositório e plano do client web
summary: >
  Registro da separação em app/ (mobile), client/ (web, ainda não implementado) e supabase/
  (backend compartilhado) e plano técnico do client web: escopo, stack, rotas, segurança, testes,
  deploy, backlog CLIENT-* e fases.
keywords: [monorepo, client, web, vite, reorganização, estrutura, workspaces, backlog]
code:
  - package.json
  - app/package.json
  - .github/workflows/ci.yml
  - client/README.md
adrs: [ADR-019, ADR-020, ADR-004, ADR-006]
last_verified_commit: 7c4199c+T-029
---

# Reorganização do repositório

Spec: [SPEC-020](../../specs/SPEC-020-reorganizacao-do-repositorio-e-plano-do-client.md) ·
decisões: [ADR-019](../../adr/ADR-019-estrutura-do-repositorio-app-client-supabase.md),
[ADR-020](../../adr/ADR-020-client-web-stack-e-integracao.md).

## Estrutura anterior

Projeto Expo único na raiz (`package.json`, `app.json`, `eas.json`, `tsconfig.json`, `eslint.config.js`,
`jest.setup.ts`, `App.tsx`, `index.ts`, `src/`, `assets/`, `.env`) ao lado de `supabase/`, `scripts/`
e da camada agentic. Um só `package.json` misturava comandos do app (`expo`, `jest`, `eslint`) com
comandos do repositório (`test:db`, `docs:index`, `docs:check`).

## Estrutura nova

```
manager-money/
├── app/            aplicativo mobile (Expo) — projeto npm independente
├── client/         aplicação web — só README (implementação pendente)
├── supabase/       backend compartilhado (migrations, testes de RLS)
├── scripts/        ai-docs (gerador e validador da knowledge layer)
├── docs/ adr/ specs/ tasks/ agents/ skills/ .orchestrator/
├── .github/        CI (jobs por projeto)
├── package.json    mínimo: docs:index, docs:check, test:db (sem dependências)
└── .gitignore .prettierrc.json .codex README.md CLAUDE.md AGENTS.md
```

## Arquivos movidos

| De | Para | Categoria |
|---|---|---|
| `src/`, `assets/`, `App.tsx`, `index.ts` | `app/` | exclusivo do mobile |
| `app.json`, `eas.json`, `tsconfig.json`, `jest.setup.ts`, `eslint.config.js` | `app/` | exclusivo do mobile (configs) |
| `package.json`, `package-lock.json` | `app/` | exclusivo do mobile (ajustado) |
| `.env`, `.env.example` | `app/` | só `EXPO_PUBLIC_*`, lidas pelo Expo na pasta do projeto |
| `.expo/`, `node_modules/`, `coverage/` (não versionados) | `app/` | gerados/cache do app |

Os arquivos foram movidos, não recriados; o git detecta as renomeações no commit e preserva o histórico.

## Arquivos mantidos na raiz

| Item | Motivo |
|---|---|
| `supabase/` | backend compartilhado, fonte única (ADR-019) |
| `scripts/ai-docs/` | ferramenta do repositório inteiro (só `node:*`, sem dependências) |
| `docs/`, `adr/`, `specs/`, `tasks/`, `agents/`, `skills/`, `.orchestrator/` | camada agentic do produto |
| `.github/` | CI do repositório |
| `.gitignore` | padrões sem `/` inicial valem em qualquer profundidade (`app/.env`, `app/node_modules`…) |
| `.prettierrc.json` | o Prettier procura a config subindo diretórios; vale para app e client |
| `.codex` | marcador vazio de ferramenta |
| `package.json` (novo) | comandos transversais |

## Ajustes realizados

- `app/package.json`: removidos `test:db`, `docs:index`, `docs:check`; `verify` = lint + typecheck +
  `test:coverage`; `testPathIgnorePatterns` sem `<rootDir>/supabase/` (não existe mais em `app/`).
- `app/eslint.config.js`: removidos os ignores `scripts/ai-docs/*` e `supabase/*` (fora do projeto).
- Docs: `code:`, `tests:` e links `src/…` → `app/src/…` em `docs/`, `agents/`, `skills/`;
  configs (`package.json`, `eas.json`…) → `app/…`; exceção `app/src/screens` no gerador do índice.
- Runbook, pipeline de qualidade, skills, README, CLAUDE.md e AGENTS.md descrevem onde rodar cada comando.
- Nenhum arquivo de `app/src/` e de `supabase/` foi alterado. Specs e tasks concluídas mantêm os
  caminhos antigos como registro histórico.

## Supabase compartilhado

Conteúdo: 6 migrations (`settings`, `fixed_expenses`, `credit_cards`, `card_purchases`,
`statement_payments`, `fixed_payments`, `extra_incomes`, `cycles`, `expenses`; trigger
`set_server_updated_at`; RPC `delete_my_account()`), testes de RLS em SQL puro e `run-plain.sh`.
**Não existem** `config.toml`, Edge Functions, seeds, tipos gerados nem fixtures.

- Tudo é compartilhado: app e client usam as mesmas tabelas, RLS e RPC. Nada a duplicar.
- `run-plain.sh` usa caminhos relativos a si mesmo; não dependia do app na raiz.
- `supabase link` / `db push` continuam rodando na raiz (o CLI procura `./supabase`).
- O app não referencia arquivos de `supabase/` (só o SDK `@supabase/supabase-js`).

## Variáveis de ambiente

| Variável | Projeto | Natureza |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `app/.env` (dev) e EAS env (builds) | pública (vai no bundle; protegida por RLS) |
| `EXPO_PUBLIC_SENTRY_DSN` | `app/.env` / EAS env | pública |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (futuro) | `client/.env` (dev) e env do provedor de deploy | pública |
| `service_role`, senha do banco, segredos de Edge Functions (futuro) | só no painel do Supabase / `supabase secrets set` / `supabase/functions/.env` local | **segredo — nunca em app ou client** |

Decisão: cada frontend tem seu `.env` (os prefixos `EXPO_PUBLIC_`/`VITE_` são exigência de cada
ferramenta e marcam o que vai para o bundle). Os valores públicos se repetem entre app e client, o que é
aceitável: não são segredos. Não há `.env` na raiz nem em `supabase/` hoje (sem Edge Functions).

## CI/CD

| Job | Diretório | Passos |
|---|---|---|
| `app` | `app/` | `npm ci` → `verify` → `expo config` → `npm audit --omit=dev --audit-level=critical` |
| `docs` | raiz | `npm run docs:check` (sem `npm ci`: scripts só usam `node:*`) |
| `database` | raiz | `bash supabase/tests/run-plain.sh` (inalterado) |
| `secrets` | raiz | gitleaks (inalterado) |
| `client` (futuro) | `client/` | `npm ci` → lint → typecheck → test → build (criar em CLIENT-004) |

Futuro: filtros `paths` por job (`app/**`, `client/**`, `supabase/**`) quando o tempo de CI pesar.

## Validações executadas

| Comando | Onde | Resultado |
|---|---|---|
| `npm ci` | `app/` | ok |
| `npm run lint` | `app/` | ok (0 avisos) |
| `npm run typecheck` | `app/` | ok |
| `npm run test:coverage` | `app/` | 24 suítes, 293 testes; cobertura 96,5% linhas / 88,5% branches |
| `npx expo config --type public` | `app/` | caminhos `./assets/*` resolvidos |
| `npx expo-doctor` | `app/` | 21/21; `.env` carregado de `app/` |
| `npx expo export -p android` | `app/` | bundle Hermes gerado (Metro resolve módulos e assets) |
| `npm run docs:check` | raiz | ver T-029 |
| `npm run test:db` | raiz | ver T-029 |

## Problemas encontrados

- Os caminhos `code:` dos docs são relativos à raiz: sem reescrever para `app/src/…`, o `docs:check`
  quebraria. Resolvido com reescrita mecânica e índice regenerado.
- `.orchestrator/context.json` excluía "web" do escopo: sobreposto pela ADR-019.
- O npm atual avisa sobre `install-scripts` não aprovados (`esbuild`, `unrs-resolver`) em `npm ci`;
  já acontecia antes da mudança e não afeta lint, testes nem bundle (fora do escopo).

---

# Planejamento do Client

## Objetivo

Uma aplicação web para **olhar o todo e administrar**, complementar ao app mobile, usando o mesmo
Supabase e **as mesmas regras financeiras**, sem reimplementá-las.

## Análise do domínio (o que existe e como reaproveitar)

Fato central: as regras rodam no cliente sobre um documento único versionado (v8). O Supabase guarda
réplicas por registro (LWW) e valida forma, não semântica. Não há RPC de negócio.

| Parte | Onde | Classificação | Uso no client |
|---|---|---|---|
| Tipos e cálculos financeiros (limite diário, status do dia, saldo, faturas, limite do cartão, projeção) | `app/src/domain/financial/*` (~1.070 linhas, só `date-fns`) | A. domínio reutilizável | reutilizar via `packages/core` |
| Casos de uso (`openCycle`, `closeCycle`, `receiveIncomeEarly`, `add/update/deleteExpense`, `payFixedExpense`, `addExtraIncome`, `saveCreditCard`, `addCardPurchase`, `payStatement`, `addStatementCharges`…) e seletores (`selectClosedMonths`, `selectCardStatements`, `selectCycleProjections`, `selectCycleSpendingRange`…) | `app/src/application/*` (~2.300 linhas, puro) | A. domínio reutilizável | reutilizar |
| `utils/date.ts`, `utils/currency.ts` (centavos, pt-BR) | `app/src/utils` | A | reutilizar |
| Contrato de sync: `types.ts` (inclui `CONTRACT_VERSION`), `mappers.ts`, `sync-engine.ts`, porta `SyncRemote`, `supabase-remote.ts`, `memory-remote.ts` | `app/src/infrastructure/sync` | B/C. infraestrutura e contrato reutilizáveis | reutilizar (motor depende de `logger` → injetar) |
| Schema do documento e migrações v1→v8 (`zod`) | `app/src/infrastructure/storage/schema.ts`, `migrations.ts` | C | reutilizar se o web tiver cache local (P1) |
| `local-store.ts` (AsyncStorage), `session-storage.ts` (SecureStore + AES), `share-json.ts` (expo-sharing), NetInfo | `app/src/infrastructure/*`, `store/` | D. específico do mobile | reimplementar adaptador web (memória/IndexedDB, `localStorage` do supabase-js, download de arquivo) |
| Store Zustand (caso de uso → persiste → agenda sync) | `app/src/store` | F. reimplementar para web | mesmo padrão, adaptadores web |
| Telas, componentes, navegação, design tokens | `app/src/screens`, `components`, `navigation`, `design` | E. específico de React Native | não copiar; só referência de textos e fluxos |
| Política de privacidade | `app/src/legal/privacy-policy.ts` | C | reutilizar o texto |
| Tabelas, RLS, `delete_my_account()` | `supabase/` | C. contrato compartilhado | mesmo uso; sem mudança de schema |

Regras que o web precisa respeitar e que só o núcleo garante: um ciclo ativo (BR-FIN-013), ciclo
fechado imutável, fatura pelo vencimento e limite ≠ dinheiro (ADR-017), pagamento de fatura e
restante transportado (ADR-018, INV-01..10), centavos inteiros (BR-FIN-001).

## Papel do app mobile

Uso diário: registrar gasto em segundos, ver o limite de hoje, marcar fixa paga, pagar fatura,
abrir/fechar ciclo. Funciona offline e sem conta.

## Papel do client web

Visão consolidada e administração, com login obrigatório: histórico completo em tabelas com filtros,
análises por categoria e período com gráficos, comparação entre ciclos, situação dos cartões e faturas,
projeção, gestão de cadastros (fontes de renda, fixas, cartões, categorias) e exportação. Ações
rápidas do dia a dia continuam sendo do mobile.

## Escopo P0/P1/P2

**P0 — MVP (valor: ver e corrigir o histórico com conforto)**
- Login/logout com e-mail e senha; sem modo local.
- Carregar os dados do usuário pelo motor de sync e montar o documento em memória.
- Visão geral do ciclo ativo (limite de hoje, saldo, compromissos, cartões) — somente leitura.
- Gastos: tabela com busca, filtros (ciclo, categoria, período), ordenação e paginação; **editar e
  excluir gasto do ciclo ativo** (fechados são somente leitura); registrar gasto.
- Ciclos: lista dos ciclos fechados com resultado e detalhe por dia.
- Análise por categoria e período com gráfico (paridade com RF-09, em tela grande).
- Estados de carregamento, vazio e erro; aviso de sessão expirada.

**P1 — próxima evolução**
- Cartões e faturas (lista, detalhe, pagar fatura total/parcial, encargos).
- Gestão de cadastros: configuração, fontes de renda, despesas fixas, cartões, categorias.
- Pagar despesa fixa, renda avulsa, abrir/fechar ciclo e "Já recebi" no web.
- Projeção dos próximos 3 ciclos com gráfico; comparação entre ciclos.
- Exportar JSON (paridade) e CSV de gastos.
- Cache local (IndexedDB) com schema/migrações do núcleo; sync ao focar a aba.
- Excluir conta.

**P2 — futuro**
- Relatórios avançados (tendências, média por categoria, sazonalidade).
- Simulação de planejamento ("e se eu parcelar em 10x?") usando `projectCycles`.
- Realtime (assinatura das tabelas) no lugar de pull ao focar.
- Tema escuro (fora do escopo do produto hoje — exige decisão), atalhos de teclado, PWA.

## Stack escolhida

**React 19 + Vite + TypeScript estrito (SPA)** — [ADR-020](../../adr/ADR-020-client-web-stack-e-integracao.md), status PROPOSED.

| Critério | React + Vite (SPA) | Next.js (App Router) |
|---|---|---|
| Necessidade de SSR/SEO | Não há: tudo fica atrás de login | SSR sem ganho real |
| Onde rodam as regras | No browser, como no mobile (núcleo puro) | Teria de escolher: cliente (SSR inútil) ou servidor (duplicar estado e sync no servidor) |
| Supabase/Auth | supabase-js padrão; sessão no `localStorage` | `@supabase/ssr` com cookies httpOnly (vantagem real contra roubo de token por XSS) |
| Deploy | Arquivos estáticos em qualquer CDN | Runtime Node/edge; mais peças |
| Superfície de ataque | Só o browser + RLS | Browser + servidor (server actions, rotas de API) |
| Compartilhar código com o app | Workspaces + TS direto no Vite | Possível, com `transpilePackages` |
| Testes | Vitest (mesma API do Jest) | Jest/Vitest + particularidades de RSC |
| DX/manutenção (1 dev) | Menos conceitos | Mais conceitos (RSC, cache, rotas de servidor) |

Decisão: a vantagem do Next (cookie httpOnly) não compensa o custo, porque o modelo de dados exige
o núcleo no cliente de qualquer forma. O risco de XSS é tratado com CSP estrita e higiene de
dependências (ver Segurança).

Bibliotecas: React Router (modo data/SPA), Zustand, React Hook Form + Zod (as mesmas do app),
Tailwind CSS + shadcn/ui (Radix: acessibilidade de diálogos, menus e tabelas), TanStack Table,
Recharts, date-fns. Sem TanStack Query no MVP: os dados vêm do documento em memória, não de consultas
por tela.

## Decisões arquiteturais

1. **Web = mais um aparelho** do usuário: pull → documento em memória → caso de uso → outbox → push.
   A resolução de conflito (LWW, ciclo ativo concorrente) é a mesma do mobile (ADR-004).
2. **Núcleo compartilhado** extraído para `packages/core` antes de qualquer tela (CLIENT-003), com
   npm workspaces; nova ADR registra a extração. O app passa a importar do pacote sem mudar comportamento.
3. **Sem modo local no web**: exige conta (os dados de quem não tem conta vivem só no aparelho).
4. **Sem mudança de schema** no MVP. Qualquer nova necessidade vira migration aditiva (ADR-008).

### Monorepo / workspaces (avaliação)

| Opção | Avaliação |
|---|---|
| **Nenhuma ferramenta agora (escolhida)** | App e client independentes; raiz com `package.json` mínimo. Suficiente enquanto não há código compartilhado |
| npm workspaces | **Próximo passo** quando `packages/core` existir (CLIENT-003). Expo SDK 52+ detecta workspaces no Metro sem config manual |
| pnpm workspaces | Melhor isolamento, mas troca o gerenciador do app (lockfile, EAS, CI) sem ganho proporcional |
| Turborepo / Nx | Cache de tarefas útil com muitos pacotes; aqui são 2 apps + 1 pacote |

Impacto futuro: com workspaces, `npm ci` passa a rodar na raiz (lockfile único), o job `app` do CI
muda para `npm ci` na raiz + `npm run verify -w app`, e o EAS precisa instalar a partir da raiz
(suportado).

## Estrutura de diretórios

```
packages/core/                 (CLIENT-003; extraído de app/src)
├── src/domain/  src/application/  src/sync/  src/utils/  src/schema/
└── package.json  tsconfig.json
client/
├── index.html  vite.config.ts  tsconfig.json  package.json  .env.example
├── public/_headers            CSP e cabeçalhos de segurança
└── src/
    ├── main.tsx  router.tsx
    ├── app/                   providers, guarda de rota, layout raiz
    ├── features/              uma pasta por área (rotas, telas, componentes da feature)
    │   ├── auth/  overview/  expenses/  cycles/  analysis/
    │   └── cards/  settings/  (P1)
    ├── components/ui/         shadcn/ui (gerados) + composições genéricas
    ├── store/                 Zustand: sessão e documento (caso de uso → outbox → sync)
    ├── infrastructure/        supabase client, SyncRemote web, logger
    ├── lib/                   formatação, helpers de tabela/gráfico
    └── styles/
tests/e2e/                     Playwright (client/tests/e2e)
```

Regra de lint (como no app): `features` não importa `@supabase/supabase-js`; regras só vêm de `@manager-money/core`.

## Rotas

| Rota | Objetivo | Dados | Ações | Prioridade |
|---|---|---|---|---|
| `/login` | Entrar | — | entrar, criar conta | P0 |
| `/` | Visão geral do ciclo ativo | `selectActiveMonth`, `selectUpcomingCommitments`, `selectCardLimitUsage` | ir para gastos/ciclos | P0 |
| `/gastos` | Tabela de gastos | gastos de todos os ciclos | buscar, filtrar, ordenar, paginar, registrar, editar/excluir (ciclo ativo) | P0 |
| `/ciclos` | Ciclos fechados e resultado | `selectClosedMonths` | filtrar por ano | P0 |
| `/ciclos/:id` | Detalhe do ciclo (por dia, fixas, rendas, faturas) | seletores do ciclo | — | P0 |
| `/analise` | Gastos por categoria e período | `selectCycleSpendingRange` | escolher período, comparar | P0 |
| `/cartoes`, `/cartoes/:id` | Cartões, limite e faturas | `selectCreditCards`, `selectCardStatements` | pagar fatura, encargos, compras | P1 |
| `/planejamento` | Projeção dos próximos ciclos | `selectCycleProjections` | — (P2: simular) | P1 |
| `/ajustes/*` | Configuração, rendas, fixas, categorias, conta | config e cadastros | CRUD, exportar, sair, excluir conta | P1 |
| `/privacidade` | Política de privacidade | texto do núcleo | — | P0 |

Rotas em português, coerentes com os textos de UI. Não há rotas separadas de `income`/`installments`:
no domínio, parcelamentos são compras de cartão ou fixas parceladas e renda é configuração + renda avulsa.

## UI/UX

- **Shell:** sidebar fixa (Visão geral, Gastos, Ciclos, Análise; P1: Cartões, Planejamento, Ajustes),
  header com ciclo ativo, status de sync e menu da conta. Abaixo de 1024px a sidebar vira drawer;
  telas pensadas para desktop, utilizáveis em tablet.
- **Visão geral:** cards de KPI (limite de hoje, saldo do ciclo, livre após compromissos, limite dos
  cartões) + lista de compromissos + gráfico de gasto diário vs. limite.
- **Tabelas:** TanStack Table com busca, filtros em chips, ordenação, paginação e colunas monetárias
  alinhadas à direita; edição em diálogo/painel lateral; linhas de ciclo fechado marcadas como somente leitura.
- **Gráficos:** barras por categoria, linha de gasto acumulado; sempre com tabela equivalente acessível.
- **Feedback:** skeletons no carregamento inicial, estados vazios com ação ("Registre o primeiro
  gasto"), toasts de sucesso, diálogo de confirmação para excluir, erros em linguagem simples, banner
  de sessão expirada e de falha de sync (com "tentar de novo").
- **Tema:** claro no MVP, com tokens de cor prontos para escuro (o produto exclui tema escuro hoje).
- Textos em português, valores em `R$` via `utils/currency` do núcleo.

## Supabase

| Aspecto | App | Client |
|---|---|---|
| Projeto | mesmo (sa-east-1) | mesmo |
| Auth | e-mail + senha (ADR-011) | idem; incluir a URL do web em *Site URL / Redirect URLs* |
| Sessão | SecureStore + AES | `localStorage` padrão do supabase-js; `autoRefreshToken` ligado |
| Refresh token | supabase-js | supabase-js; em `42501`/JWT expirado: refresh → se falhar, volta ao login |
| Dados | upsert/pull pelas 9 tabelas | idem, pelo mesmo motor (`SyncRemote`) |
| RLS | `(select auth.uid()) = user_id` em todas | idem — é a proteção real |
| RPC | `delete_my_account()` | idem (P1) |
| Views, Edge Functions, Storage | não existem | não necessárias no MVP |
| Realtime | não usado | P2 |
| Tipos | DTOs em `sync/types.ts` | os mesmos do núcleo; `supabase gen types` opcional no futuro |

Conflito entre aparelhos: o web usa a mesma regra do mobile (o ciclo ativo do servidor vence,
ADR-004 §4). Para reduzir janelas de conflito, o web faz pull ao focar a aba e antes de abrir/fechar ciclo.

## Segurança

**Backend (a proteção real)**
- RLS em todas as tabelas; nenhuma autorização depende de esconder tela.
- Só anon key + JWT do usuário no client; `service_role` nunca em frontend (ADR-006).
- Checks do schema (valores ≥ 0, um ciclo ativo, FKs) continuam válidos para escrita do web.
- `delete_my_account()` é `security definer` restrito a `auth.uid()` — revisar o mesmo teste de RLS.
- Avaliar CAPTCHA/rate limit do Auth, porque o web expõe o login a automação com mais facilidade.

**Frontend**
- **XSS** (principal risco, pois a sessão fica no `localStorage`): React escapa por padrão; proibir
  `dangerouslySetInnerHTML` por lint; CSP estrita em `_headers` (`default-src 'self'`,
  `connect-src` só o domínio do Supabase, sem `unsafe-inline` em script), `frame-ancestors 'none'`,
  `Referrer-Policy`, `X-Content-Type-Options`; dependências mínimas e `npm audit` no CI.
- **CSRF:** não se aplica (sem cookies de sessão; o token vai no header `Authorization`).
- **Proteção de rotas:** guarda redireciona para `/login` sem sessão — é UX, não segurança.
- **Inputs:** Zod nos formulários com as mesmas regras do núcleo; o núcleo valida de novo nos casos de uso.
- **Tokens e logs:** nunca logar token, e-mail ou valores (mesmo `logger` do núcleo); sem dados
  financeiros em URL (filtros por ID/período, não por valor).
- **Armazenamento local:** no MVP só a sessão do supabase-js; o cache em IndexedDB (P1) contém dados
  financeiros e deve ser apagado no logout.
- **Variáveis:** só `VITE_*` públicas no bundle; build falha se faltarem.

## Compartilhamento de código

Recomendado **um** pacote, `packages/core`, porque o compartilhamento é comprovado e crítico:

| Conteúdo | Arquivos reais | Por quê |
|---|---|---|
| domínio | `financial.calculations.ts`, `credit-card.ts`, `payments.ts`, `projection.ts`, `financial.types.ts` | regras BR-FIN-*; divergir quebra invariantes |
| aplicação | `cycle/card/payment.use-cases.ts`, `selectors.ts`, `state.ts`, `errors.ts` | o web precisa gravar com as mesmas regras |
| sync | `types.ts`, `mappers.ts`, `sync-engine.ts`, `memory-remote.ts`, `supabase-remote.ts` | contrato e conflito idênticos nos dois clientes |
| utils | `date.ts`, `currency.ts` | ciclo e formatação em centavos |
| schema | `schema.ts`, `migrations.ts` | só quando houver cache local no web (P1) |

Não recomendados agora: `packages/types` e `packages/validation` separados (os tipos já moram no
domínio; não há validação compartilhável fora do schema) e `packages/ui` (RN e web não compartilham componentes).

## Testes

| Nível | Ferramenta | O que cobrir |
|---|---|---|
| Unitário | Vitest | adaptadores web (SyncRemote web, store), helpers de tabela/gráfico. Regras já testadas no núcleo (Jest do pacote) |
| Componente | Vitest + Testing Library | formulários (validação, centavos), tabela de gastos (filtro, somente leitura em ciclo fechado), guarda de rota |
| Integração | Vitest + `MemoryRemote` do núcleo | login simulado → pull → editar gasto → push; conflito de ciclo ativo |
| E2E | Playwright | 3 fluxos smoke: login, registrar/editar gasto, navegar ciclos e análise — contra projeto Supabase de teste ou local |

Meta: cobertura ≥ 80% em `store`, `infrastructure` e `lib` do client (mesmo critério do app);
telas sem meta numérica.

## CI/CD

Job `client` em `.github/workflows/ci.yml` com `working-directory: client`: `npm ci`, lint, typecheck,
test, build, `npm audit --omit=dev --audit-level=critical`. Com workspaces, o pacote `core` ganha
testes próprios e os jobs de app/client dependem dele. Preview deploy por PR pelo provedor.

## Deploy

| Opção | Custo | Previews | Observação |
|---|---|---|---|
| **Cloudflare Pages (recomendado)** | Free com banda ilimitada | por PR | `_headers` para CSP; CDN com PoP em São Paulo |
| Vercel | Hobby free (uso não comercial) | por PR | excelente DX; limites de banda e termos do plano gratuito |
| Netlify | Free com limite de banda | por PR | equivalente; `_headers` igual |

Variáveis `VITE_SUPABASE_*` configuradas no painel por ambiente (preview → projeto de teste,
produção → projeto real). SPA precisa de fallback para `index.html`.

## Backlog

**CLIENT-001 — Decidir e aprovar a ADR-020**
Objetivo: fechar stack e modelo de integração. Dependências: —.
Aceite: ADR-020 ACCEPTED; SPEC do client criada; `context.json` atualizado.

**CLIENT-002 — Bootstrap do projeto**
Objetivo: Vite + React + TS estrito em `client/`. Dependências: CLIENT-001.
Aceite: `npm run dev/build` funcionam; `tsconfig` estrito igual ao app; `.env.example` com `VITE_*`; README atualizado.

**CLIENT-003 — Extrair `packages/core` com npm workspaces**
Objetivo: fonte única das regras. Dependências: CLIENT-001; ADR própria.
Aceite: app importa do pacote; `cd app && npm run verify` e `expo export` verdes; testes do núcleo
movidos com o código; cobertura mantida; EAS build preview validado; `logger` injetado no motor de sync.

**CLIENT-004 — Lint, formatação e CI**
Objetivo: mesmos gates do app. Dependências: CLIENT-002.
Aceite: ESLint com regra de camadas e proibição de `dangerouslySetInnerHTML`; Prettier da raiz; job `client` no CI.

**CLIENT-005 — Configuração de testes**
Objetivo: Vitest + Testing Library + Playwright. Dependências: CLIENT-002.
Aceite: um teste de cada tipo rodando no CI; limiar de cobertura configurado.

**CLIENT-006 — Integração Supabase e SyncRemote web**
Objetivo: cliente Supabase e motor de sync do núcleo no browser. Dependências: CLIENT-003.
Aceite: pull monta o documento em memória; push envia o outbox; testes com `MemoryRemote`; erro de rede mantém pendências.

**CLIENT-007 — Autenticação**
Objetivo: login, criação de conta e logout. Dependências: CLIENT-006.
Aceite: e-mail + senha (mín. 8); sessão persiste no reload; logout limpa estado; erros em pt-BR; nenhum log de e-mail/token.

**CLIENT-008 — Proteção de rotas e sessão expirada**
Dependências: CLIENT-007. Aceite: rotas privadas redirecionam; refresh automático; falha de refresh → login com aviso.

**CLIENT-009 — Layout principal e navegação**
Dependências: CLIENT-008. Aceite: sidebar, header com ciclo e status de sync, drawer < 1024px, páginas de erro/404.

**CLIENT-010 — Visão geral (dashboard)**
Dependências: CLIENT-009. Aceite: KPIs e compromissos iguais aos números do app para o mesmo documento (teste com fixture); skeleton e vazio.

**CLIENT-011 — Tabela de gastos**
Dependências: CLIENT-009. Aceite: busca, filtros, ordenação, paginação; totais em centavos corretos.

**CLIENT-012 — Registrar, editar e excluir gasto**
Dependências: CLIENT-011. Aceite: usa `addExpense/updateExpense/deleteExpense` do núcleo; ciclo fechado somente leitura; confirmação ao excluir; sincroniza com o mobile.

**CLIENT-013 — Ciclos e detalhe do ciclo**
Dependências: CLIENT-009. Aceite: lista com resultado e filtro por ano; detalhe por dia igual ao histórico do app.

**CLIENT-014 — Análise por categoria e período**
Dependências: CLIENT-009. Aceite: gráfico + tabela acessível; período livre; mesmos totais do app.

**CLIENT-015 — Hardening do MVP**
Dependências: CLIENT-010..014. Aceite: CSP e cabeçalhos; auditoria (`fullstack-security-guardian`); E2E smoke verdes; acessibilidade de teclado.

**CLIENT-016 — Deploy**
Dependências: CLIENT-015. Aceite: Cloudflare Pages com preview por PR; env por ambiente; URL no Auth do Supabase; runbook atualizado.

**CLIENT-017..022 (P1)** — Cartões e faturas · Cadastros e configuração · Fixas, renda avulsa e ciclo
(abrir/fechar/"Já recebi") · Projeção e comparação · Exportação JSON/CSV e exclusão de conta ·
Cache IndexedDB com schema do núcleo.

## Ordem de implementação

| Fase | Objetivo | Tarefas | Depende de | Resultado |
|---|---|---|---|---|
| 0 — Fundação | projeto e núcleo prontos | 001–005 | — | client vazio com gates; app usando `packages/core` |
| 1 — Autenticação | entrar e manter sessão | 006–008 | 0 | usuário logado com documento em memória |
| 2 — Shell | navegação desktop | 009 | 1 | layout navegável |
| 3 — Visão geral | valor imediato | 010 | 2 | dashboard consolidado |
| 4 — Gestão de gastos | administrar histórico | 011–013 | 2 | tabela e ciclos com edição |
| 5 — Relatórios | análise | 014 | 2 | análise por categoria/período |
| 6 — Hardening | segurança e qualidade | 015 | 3–5 | MVP auditado |
| 7 — Deploy | publicar | 016 | 6 | MVP no ar |
| 8 — P1 | paridade e gestão | 017–022 | 7 | web completo para administração |

## Riscos

- **Divergência de regras** se alguém gravar direto nas tabelas sem o núcleo → lint + revisão; só o núcleo escreve.
- **Extração do núcleo quebrar o app** (Metro/Jest/EAS com workspaces) → CLIENT-003 isolada, com
  `expo export` e build preview antes de seguir.
- **Versões diferentes:** o web atualiza na hora e o mobile depende das lojas → contrato aditivo, `CONTRACT_VERSION` checado.
- **Conflitos entre aparelhos** em ações de ciclo → pull antes de abrir/fechar; regra do servidor vence.
- **XSS com sessão em `localStorage`** → CSP estrita, sem HTML dinâmico, dependências enxutas.
- **Volume:** documento inteiro em memória — aceitável para finanças pessoais; medir se passar de alguns milhares de gastos.

## Dúvidas em aberto

1. O web deve permitir **criar conta** ou só entrar com conta criada no app?
2. Domínio e provedor de deploy definitivos (Cloudflare Pages vs. Vercel) e se há uso comercial.
3. Em P1, abrir/fechar ciclo no web é desejado ou fica exclusivo do mobile?
4. Tema escuro segue fora do escopo do produto?
5. Projeto Supabase separado para previews/E2E ou só o de produção?
