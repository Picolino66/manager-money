---
spec: SPEC-012
features: [planning.income-sources]
---
# SPEC-012 — Múltiplas fontes de renda

## Objetivo
Permitir cadastrar mais de uma fonte de renda mensal (nome + valor) na configuração financeira.

## Docs relacionados
[business-rules](../docs/business/business-rules.md) · [configure](../docs/modules/planning/configure.md) · [contracts](../docs/architecture/contracts.md) · [ADR-013](../adr/ADR-013-fontes-de-renda.md)

## Requisitos relacionados
RF-01 · BR-FIN-004, BR-FIN-018

## Regras
- A renda mensal é a **soma das fontes**; cada fonte tem nome (obrigatório) e valor > 0.
- Ao menos uma fonte é obrigatória (formulário e caso de uso).
- Dados antigos (documento v2, linha remota sem `income_sources`) viram uma fonte "Renda".
- Alterar apenas as fontes marca `settings` como pendente de sync; salvar sem mudanças não gera pendência.

## Comportamento
- Configuração: cartão "Renda mensal" com a lista de fontes, **Adicionar**, **Remover** (se houver mais de uma) e "Total: R$ …".
- O aviso de plano acima da renda (BR-FIN-015) usa o total das fontes.
- Dashboard e início de ciclo continuam exibindo "Renda mensal" (total).

## Fluxos
FLOW-primeiro-uso, passo 2.

## Critérios de aceite
- [x] Duas fontes somam no saldo base e na renda mensal exibida.
- [x] Zero fontes é rejeitado; nome ou valor vazio mostra erro no formulário.
- [x] Migração v2 → v3 preserva a renda como fonte "Renda" e marca `dirty`.
- [x] Linha remota antiga (sem `income_sources`) é lida como uma fonte "Renda".
- [x] Migration e RLS cobrem `income_sources` (`npm run test:db`).

## Tasks derivadas
T-018
