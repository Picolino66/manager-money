---
spec: SPEC-011
features: []
---
# SPEC-011 — Upgrade do Expo SDK 57

## Objetivo
Manter o app compatível com o Expo Go atual e com o tooling sem vulnerabilidades conhecidas, sem mudar comportamento.

## Docs relacionados
[ADR-012](../adr/ADR-012-upgrade-expo-sdk-57.md) · [overview](../docs/architecture/overview.md)

## Requisitos relacionados
RNF-10 (compatibilidade), RNF-09 (qualidade)

## Regras
- Nenhuma regra de negócio muda. Os testes existentes não podem ser alterados para "passar", só adaptados a mudanças de API de bibliotecas.

## Comportamento
Idêntico ao SDK 54.

## Fluxos
Todos (regressão).

## Critérios de aceite
- [ ] `npx expo-doctor` sem erros
- [ ] `npm run verify` verde (lint, tipos, testes ≥ 80%, docs)
- [ ] Bundle Android gerado (`expo export`)
- [ ] `npm audit --omit=dev`: sem críticas; altas do relatório da F6 reavaliadas
- [ ] Novo APK preview gerado no EAS
- [ ] App abre no Expo Go SDK 57 via QR code (validação do dono do produto)

## Tasks derivadas
T-017
