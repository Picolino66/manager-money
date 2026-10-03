---
spec: SPEC-014
features: [payment.fixed-expense, payment.extra-income]
---
# SPEC-014 — Pagamento de despesas fixas e renda avulsa

## Objetivo
Confirmar a cada ciclo o pagamento das despesas fixas (Pix, dinheiro, débito ou crédito com juros) e lançar rendas avulsas, com o saldo do ciclo acompanhando.

## Docs relacionados
[business-rules](../docs/business/business-rules.md) · [fixed-expense](../docs/modules/payment/fixed-expense.md) · [extra-income](../docs/modules/payment/extra-income.md) · [contracts](../docs/architecture/contracts.md) · [ADR-015](../adr/ADR-015-pagamento-de-fixas-e-renda-avulsa.md)

## Requisitos relacionados
RF-20, RF-21 · BR-FIN-004, BR-FIN-005, BR-FIN-019, BR-FIN-021, BR-FIN-022, BR-FIN-023

## Regras
- Todo ciclo mostra as despesas fixas (e a parcela do mês dos parcelamentos com parcelas restantes) como **Pendente** ou **Pago**.
- Pendente **não desconta** o saldo; pagar à vista (Pix, dinheiro, débito) desconta da renda do ciclo na hora.
- Pagar no crédito pede cartão, parcelas e **juros em R$** (≥ 0); vira compra no cartão de `valor + juros` e só as parcelas descontam (BR-FIN-019/020). A prévia mostra "Total … em Nx de … · 1ª parcela entra neste ciclo/no próximo".
- No máximo um pagamento vigente por despesa e ciclo; **Desfazer** vale no ciclo ativo e, no crédito, remove também a compra.
- Pagamentos e rendas avulsas pertencem ao ciclo em que foram lançados (não migram no recebimento antecipado).
- Renda avulsa: nome, valor > 0 e data dentro do ciclo ativo; soma ao saldo; pode ser excluída no ciclo ativo.
- A migração do documento (v4 → v5) devolve ao ciclo ativo o que as fixas já haviam descontado.

## Comportamento
- **Hoje:** cartão "Despesas fixas do ciclo" sempre visível (status, valor, **Pagar**/**Desfazer**, resumo Pagas/Pendentes); botão **Renda** abre "Rendas do ciclo"; "Plano do ciclo" mostra rendas avulsas, fixas pagas e faturas.
- **Pagar:** modal com Pix, Dinheiro, Débito, Crédito; no crédito: cartão, parcelas e juros.
- **Rendas do ciclo:** lista, adiciona e exclui rendas avulsas.

## Fluxos
FLOW-registrar-gasto (extensão) · novo: pagar despesa fixa.

## Critérios de aceite
- [x] Fixa pendente não muda o saldo; pagar à vista (Pix/dinheiro/débito) desconta da renda do ciclo.
- [x] No crédito, juros somam ao valor, a compra respeita o fechamento e o saldo só cai pelas parcelas.
- [x] Desfazer devolve o saldo (e remove a compra no crédito); um pagamento por fixa por ciclo.
- [x] Renda avulsa soma ao saldo, valida nome/valor/data e pode ser excluída.
- [x] No ciclo seguinte as fixas voltam a Pendente e o ciclo fechado mantém seus pagamentos.
- [x] Migração v4 → v5, sync entre aparelhos, migration e RLS (`npm run test:db`).

## Tasks derivadas
T-020
