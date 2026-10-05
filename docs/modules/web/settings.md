---
id: web.settings
type: feature
module: web
title: Ajustes, configuração financeira e exportação (web)
summary: >
  Tela Ajustes com atalhos, configuração financeira (renda, meta, despesas fixas e parcelamentos) pelo
  caso de uso saveConfig e exportação do JSON sem dados de sessão.
keywords: [ajustes, configuração, renda, meta, despesas fixas, parcelamentos, exportar, json]
code:
  - client/src/features/settings/SettingsPage.tsx
  - client/src/features/settings/ConfigPage.tsx
  - client/src/features/settings/ExportPage.tsx
  - client/src/lib/settings.ts
  - client/src/lib/download.ts
  - packages/core/src/application/export-data.ts
symbols: [configToForm, formToConfigInput, plannedOutflowExceedsIncome, downloadTextFile, buildExportPayload, exportFileName]
business_rules: [BR-FIN-018, BR-FIN-024, BR-FIN-035, BR-ACC-004]
adrs: [ADR-020, ADR-022]
tests: [client/src/lib/settings.test.ts, client/src/features/settings.test.tsx, packages/core/src/application/export-data.test.ts]
last_verified_commit: 7903717+T-042b
---

# Ajustes (CLIENT-017/018)

- `/ajustes`: Configuração financeira, Cartões, Exportar dados e Política de privacidade (os mesmos atalhos
  do app, sem "Conta e sincronização": o web não sincroniza).
- `/ajustes/configuracao`: fontes de renda (nome, valor, dia 1–28, ativa), meta de economia, despesas fixas e
  parcelamentos fora do cartão (ativar/desativar, remover). Mesmas validações do app (`configSchema`);
  `formToConfigInput` → `saveConfig` do núcleo, que valida de novo. Ao menos uma fonte ativa (BR-FIN-018);
  o ciclo usa o dia da fonte ativa de maior valor (BR-FIN-024). As categorias personalizadas não mudam
  aqui. Fixas e meta acima da renda pedem confirmação ("Salvar mesmo assim"). Grava só `settings` e
  `fixed_expenses` alterados; falha mantém o formulário com o erro. Cada despesa fixa permanente tem "Recorrente no cartão de crédito" + escolha do cartão ativo (BR-FIN-035, SPEC-024): a cobrança no cartão acontece a cada virada de fatura (o app confere e lança); o web mostra as pagas automáticas no Histórico como Fixo · Crédito.
- `/ajustes/exportar`: `buildExportPayload` (núcleo, o mesmo do app) sem `sync` além de `lastSyncAt`
  (BR-ACC-004); `downloadTextFile` entrega o arquivo por `Blob` e libera o endereço na hora. Só lê; avisa que o
  arquivo contém dados financeiros sem proteção.
