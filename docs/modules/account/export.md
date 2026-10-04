---
id: account.export
type: feature
module: account
title: Exportar dados
summary: >
  Gera um JSON com todos os dados (sem identificadores de sessão) e abre o compartilhamento nativo.
keywords: [exportar, backup, json, lgpd, portabilidade]
code:
  - app/src/infrastructure/export/share-json.ts
  - packages/core/src/application/export-data.ts
  - app/src/screens/SettingsScreen.tsx
symbols: [buildExportPayload, shareJson, exportFileName]
business_rules: [BR-ACC-004]
tests: [app/src/infrastructure/export/share-json.test.ts]
last_verified_commit: 7903717+T-041
---

# Exportar dados

Ajustes → Exportar dados (a montagem do JSON mora no núcleo, `export-data.ts`, e o web usa a mesma) → `manager-money-AAAA-MM-DD.json` (documento local atual — v8 — sem `userId`/cursores).
Funciona sem login. O arquivo temporário é apagado do cache ao fim do compartilhamento (achado S1). Na tela de erro de carregamento, "Exportar dados brutos" exporta o conteúdo
original para recuperação.
