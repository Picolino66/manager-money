---
spec: SPEC-015
features: [planning.income-sources, planning.payday]
---
# SPEC-015 — Dia de pagamento por fonte de renda

## Objetivo
Cada fonte de renda tem o seu dia de pagamento; o campo global sai da Configuração.

## Docs relacionados
[business-rules](../docs/business/business-rules.md) · [income-sources](../docs/modules/planning/income-sources.md) · [payday](../docs/modules/planning/payday.md) · [ADR-016](../adr/ADR-016-dia-de-pagamento-por-fonte.md)

## Requisitos relacionados
RF-12 · BR-FIN-002, BR-FIN-018, BR-FIN-024 (estende a [SPEC-001](SPEC-001-dia-de-pagamento.md))

## Regras
- Dia por fonte: inteiro de 1 a 28 (formulário e caso de uso). Novo item herda o dia da fonte principal.
- O ciclo usa o dia da fonte de maior valor (empate: a primeira); `settings.payday` é derivado.
- Alterar fontes não muda o ciclo ativo; vale para o próximo.
- Dados antigos: cada fonte recebe o dia global anterior (nenhum ciclo muda).

## Comportamento
- Configuração: sem "Dia do pagamento" global; cada fonte tem "Dia do pagamento (1 a 28)" e a tela mostra "O ciclo usa o dia X (fonte, a de maior valor)".

## Fluxos
FLOW-primeiro-uso, passo 2.

## Critérios de aceite
- [x] Duas fontes: o ciclo usa o dia da maior; trocar a maior muda o dia derivado.
- [x] Dia fora de 1–28 é rejeitado no formulário e no caso de uso.
- [x] Migração v5 → v6 preserva o dia global em cada fonte; linha remota antiga herda o dia da linha.

## Tasks derivadas
T-021
