---
id: web.shell
type: feature
module: web
title: Layout, navegação e tema (web)
summary: >
  Sidebar fixa em telas ≥ 1024px e drawer abaixo disso, cabeçalho com ciclo ativo e indicador de
  gravação, menu da conta com tema Sistema/Claro/Escuro, páginas de erro e 404.
keywords: [layout, sidebar, drawer, tema escuro, navegação, 404]
code:
  - client/src/app/AppShell.tsx
  - client/src/app/StatusPages.tsx
  - client/src/components/AccountMenu.tsx
  - client/src/store/theme.store.ts
  - client/src/infrastructure/theme-preference.ts
  - client/src/styles/index.css
symbols: [AppShell, AccountMenu, useThemeStore, resolveScheme, readThemePreference]
adrs: [ADR-021, ADR-020]
tests: [client/src/store/theme.store.test.ts, client/src/styles/tokens.test.ts]
last_verified_commit: 3b9bf25+T-040
---

# Shell e tema

- **Tema (ADR-021):** "Sistema" por padrão, escolha manual salva em `manager-money:theme-preference`;
  aplicado em `<html data-theme>` antes do primeiro render (sem script inline, por causa da CSP).
- **Tokens:** mesmos nomes e valores de `app/src/design/theme.ts` como variáveis CSS (kebab-case) e
  classes Tailwind (`bg-surface`, `text-ink`…). `tokens.test.ts` compara com as paletas do app.
- **Acessibilidade:** link "Pular para o conteúdo", foco visível, diálogos Radix (foco preso, Esc),
  status por texto + cor, tabelas com `caption` e `aria-sort`, gráficos com tabela equivalente.
- Estados: skeleton no carregamento, erro com "Tentar de novo", 404, tela de configuração ausente.
