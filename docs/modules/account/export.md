---
id: account.export
type: feature
module: account
title: Exportar dados
summary: >
  Gera um JSON com todos os dados (sem identificadores de sessão) e abre o compartilhamento nativo.
keywords: [exportar, backup, json, lgpd, portabilidade]
code:
  - src/infrastructure/export/share-json.ts
  - src/screens/SettingsScreen.tsx
symbols: [buildExportPayload, shareJson, exportFileName]
business_rules: [BR-ACC-004]
tests: [src/infrastructure/export/share-json.test.ts]
last_verified_commit: F6-PENDING
---

# Exportar dados

Ajustes → Exportar dados → `manager-money-AAAA-MM-DD.json` (documento v2 sem `userId`/cursores).
Funciona sem login. O arquivo temporário é apagado do cache ao fim do compartilhamento (achado S1). Na tela de erro de carregamento, "Exportar dados brutos" exporta o conteúdo
original para recuperação.
