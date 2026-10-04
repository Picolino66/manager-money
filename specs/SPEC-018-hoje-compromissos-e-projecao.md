---
spec: SPEC-018
features: [cycle.dashboard, payment.fixed-expense]
---
# SPEC-018 — Hoje enxuta, próximos compromissos e projeção

## Objetivo
Fazer a tela Hoje responder em segundos "quanto posso gastar hoje **e continuar atingindo minha meta**?", com as despesas fixas pendentes já reservadas, a lista do que ainda vai sair (faturas e fixas) e a projeção dos próximos ciclos.

## Docs relacionados
[business-rules](../docs/business/business-rules.md) · [dashboard](../docs/modules/cycle/dashboard.md) · [fixed-expense](../docs/modules/payment/fixed-expense.md) · [product](../docs/business/product.md) · [ADR-017](../adr/ADR-017-faturas-limite-e-situacao-inicial.md)

## Requisitos relacionados
RF-04, RF-20, RF-27, RF-28 · BR-FIN-004, BR-FIN-005, BR-FIN-007, BR-FIN-021, BR-FIN-026, BR-FIN-030, BR-FIN-031

## Regras
- **Reserva de fixas (BR-FIN-004):** saldo base = renda (fontes ativas) + rendas avulsas − fixas do ciclo − meta, com fixas do ciclo = pagas à vista + ativas ainda pendentes. Pagar à vista **não muda** o saldo (já estava reservado); pagar no crédito tira a reserva e o valor passa a pesar pelas faturas.
- **Saldo inicial (BR-FIN-005):** base − dívida herdada − parcelas de cartão do ciclo − juros de faturas pagas com atraso no ciclo.
- **Próximos compromissos (`selectUpcomingCommitments`):** faturas **não pagas** que já fecharam (fechadas ou vencidas) ou que vencem até o fim do ciclo ativo, ordenadas por vencimento; depois as despesas fixas ativas pendentes do ciclo (`selectPendingFixedExpenses` ignora valor 0, p.ex. parcelamento quitado). Fatura vencida é sinalizada.
- **Projeção (BR-FIN-031, `selectCycleProjections`):** para os próximos 3 ciclos (a partir do ativo ou do próximo a abrir): renda (ativas) − meta − fixas ativas (parcelamentos só enquanto restarem parcelas) − parcelas de cartão do ciclo = **"Livre antes de novos gastos"** (pode ser negativo). Não inclui dívida herdada, juros nem gastos variáveis.
- **Sem dupla contagem (BR-FIN-030):** gasto à vista → dia; fixa → reserva do ciclo (à vista) ou fatura (crédito); compra no crédito → fatura → ciclo do vencimento; juros de atraso → ciclo do pagamento.
- **Linguagem:** "Ainda pode gastar hoje" é dinheiro do ciclo; "Limite disponível do cartão" nunca aparece como dinheiro para gastar.
- Formas de pagamento na UI: **À vista** (gravada `cash`) e **Cartão de crédito**; `pix`/`debit` seguem válidos em dados antigos.

## Comportamento (tela Hoje)
- **Topo:** "Ainda pode gastar hoje" (saldo do dia) com status; abaixo, gasto de hoje e limite de hoje.
- **Ações principais:** Registrar gasto e Renda.
- **Próximos compromissos:** lista curta (fatura do cartão com vencimento, fixas pendentes com **Pagar**); vazio = "Nada pendente neste ciclo".
- **Resumo do ciclo:** saldo inicial, restante, gasto e dias restantes; detalhamento (renda, rendas avulsas, fixas reservadas/pagas, meta, faturas, juros, dívida) em área recolhida.
- **Próximos ciclos:** projeção com "Livre antes de novos gastos" por ciclo, com aviso quando negativo.
- Ações de ciclo (Já recebi, fim do ciclo, Fechar ciclo) mantidas no fim da tela.

## Fluxos
FLOW-registrar-gasto · FLOW-fim-de-ciclo.

## Critérios de aceite
- [x] Fixa pendente fica reservada; pagar à vista não desconta de novo; pagar no crédito sai da reserva e pesa só pela fatura.
- [x] Juros de fatura paga com atraso reduzem o saldo do ciclo ativo.
- [x] `selectUpcomingCommitments` e `selectCycleProjections` cobertos por testes (domínio/aplicação).
- [x] Abrir o ciclo seguinte não conta duas vezes a parcela já projetada.
- [x] Hoje enxuta com próximos compromissos e projeção (T-024).

## Casos de borda
| Caso | Comportamento |
|---|---|
| Sem ciclo ativo | Sem compromissos de fixas; projeção a partir do próximo ciclo a abrir. |
| Fatura aberta que vence depois do fim do ciclo | Não entra em próximos compromissos (pesa no ciclo do vencimento). |
| Fatura vencida e não paga | Aparece como vencida até "Paguei a fatura". |
| Parcelamento fixo ainda não iniciado | Na projeção, começa a contar no próximo ciclo. |
| Parcelamento fixo quitado (0 restantes) | Não reserva nem aparece como pendente. |
| Abertura de ciclo | A reserva usa as parcelas já avançadas (não reserva parcela que acabou de terminar). |
| Fixa ou fonte inativa | Fora da reserva, dos compromissos e da projeção. |
| Livre negativo na projeção | Mostrado como valor negativo com aviso; não bloqueia nada. |
| Migração de versão anterior com ciclo ativo | A migração não mexe no saldo; o recálculo ao carregar o app faz o saldo cair no total das fixas pendentes (agora reservadas). |
| Dado novo vindo de outro aparelho | O saldo do ciclo ativo é recalculado ao fim de cada sync, depois dos pulls. |

## Tasks derivadas
T-022, T-024
