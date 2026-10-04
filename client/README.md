# client — aplicação web do Manager Money

SPA (React 19 + Vite + TypeScript estrito) para **ver e administrar o histórico** com a mesma conta e as
mesmas regras do app mobile. P0 implementado; uso **local** por enquanto (VPS no futuro).

- **Sempre online, sem sync:** ao entrar, lê do Supabase as linhas do usuário e monta o estado em memória.
  Cada ação recarrega → aplica o caso de uso do núcleo (`@manager-money/core`) → grava na hora só os
  registros alterados. Nenhum dado financeiro fica no navegador (só a sessão e o tema).
- **Regras:** nunca aqui. Tudo vem de [`packages/core`](../packages/core) (o mesmo código do app).
- **Backend:** o mesmo Supabase do app, em [`../supabase`](../supabase) (RLS é a proteção real).

Plano e backlog: [docs/architecture/client-web-plan.md](../docs/architecture/client-web-plan.md) · módulo:
[docs/modules/web](../docs/modules/web/index.md) · decisões: [ADR-020](../adr/ADR-020-client-web-stack-e-integracao.md),
[ADR-021](../adr/ADR-021-tema-claro-e-escuro.md), [ADR-022](../adr/ADR-022-nucleo-compartilhado-packages-core.md).

## Rodar localmente

```bash
npm install                    # na RAIZ do repositório (npm workspaces)
cd client
cp .env.example .env           # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev                    # http://localhost:5173
```

Os valores são os mesmos `EXPO_PUBLIC_SUPABASE_*` do `app/.env` (públicos, protegidos por RLS). A
`service_role` nunca entra aqui. Sem as variáveis, o app mostra a tela "Configuração ausente" e o
`build` falha de propósito.

Build de produção com os cabeçalhos de segurança (CSP etc.) que irão para a VPS:

```bash
npm run build && npm run preview   # http://localhost:4173
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run verify` | lint (0 avisos) + typecheck + Vitest com cobertura (≥ 80% em store, infrastructure, lib) |
| `npm run test` | testes unitários, de componente e de integração (Supabase simulado em memória) |
| `npm run test:e2e` | Playwright local (build + preview). Fluxo autenticado só com `E2E_EMAIL`/`E2E_PASSWORD` de um **usuário de teste dedicado** no `.env` |
| `npm run format` | Prettier (config da raiz) |

## Estrutura

```
src/
├── main.tsx  router.tsx        entrada e rotas (/login, /comecar, /, /gastos, /ciclos, /ciclos/:id, /analise, /privacidade)
├── app/                        guarda de rota, layout (sidebar/drawer), páginas de status
├── features/                   telas por área: auth, onboarding, overview, expenses, cycles, analysis, legal
├── components/ (ui/)           componentes Radix + Tailwind no padrão shadcn/ui
├── store/                      Zustand: sessão, dados (caso de uso → grava), tema
├── infrastructure/             Supabase (leitura/upsert), repositório, auth, logger, preferência de tema
├── lib/                        view models puros (testados contra o núcleo)
└── styles/index.css            tokens do tema (mesmos do app) como variáveis CSS
security/                       CSP e cabeçalhos (+ exemplos Nginx/Caddy para a VPS)
tests/e2e/                      Playwright
```

Lint garante as camadas: telas não importam o Supabase nem a infraestrutura; `dangerouslySetInnerHTML`
é proibido; `localStorage` só para a preferência de tema.
