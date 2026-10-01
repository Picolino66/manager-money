---
spec: SPEC-004
features: [storage.local-document]
---
# SPEC-004 — Documento local versionado

## Objetivo
Escrita atômica, migração explícita e recuperação de falhas de leitura (DEF-002, DEF-004).

## Docs relacionados
[contracts §4](../docs/architecture/contracts.md) · [ADR-003](../adr/ADR-003-persistencia-local.md)

## Requisitos relacionados
RNF-03 · DEF-002, DEF-004

## Regras
- Uma chave: `@manager-money/state`; `schemaVersion: 2`; validação Zod na leitura.
- Migração v1 → v2 a partir das chaves `@daily-budget/*`. As chaves v1 só são removidas **depois** da gravação v2 bem-sucedida.
- Um documento inválido nunca é sobrescrito automaticamente.

## Comportamento
- Na falha de leitura, mostra a tela "Não foi possível ler os dados salvos" com as ações **Tentar novamente** e **Exportar dados brutos**.
- Sem dados, o estado é vazio (`settings: null`).

## Fluxos
Inicialização do app.

## Critérios de aceite
- [ ] Os dados v1 (incluindo os formatos legados: fixos numéricos e ciclo por mês civil) migram sem perda.
- [ ] Toda mutação faz exatamente 1 `setItem`.
- [ ] Um JSON inválido mostra a tela de erro, e a chave original permanece intacta.

## Tasks derivadas
T-003
