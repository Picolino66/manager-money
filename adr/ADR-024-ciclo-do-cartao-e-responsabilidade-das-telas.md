# ADR-024 — Dois ciclos (salário e cartão) e uma responsabilidade por tela

- **Status:** ACCEPTED · **Fase:** F4 (evolução) · **Data:** 2026-10-05
- **Depende de:** [ADR-017](ADR-017-faturas-limite-e-situacao-inicial.md), [ADR-018](ADR-018-pagamento-parcial-e-total-da-fatura.md),
  [ADR-020](ADR-020-client-web-stack-e-integracao.md), [ADR-022](ADR-022-nucleo-compartilhado-packages-core.md).
- **Spec:** [SPEC-025](../specs/SPEC-025-ciclo-do-cartao-e-telas.md) · task [T-043](../tasks/done/T-043.md).

## Contexto
O sistema foi construído sobre o ciclo do **salário** (BR-FIN-002). O cartão tem outro ciclo: a fatura abre no dia
seguinte ao fechamento anterior, fecha no `closingDay` e vence no `dueDay`, e pesa no ciclo do salário em que vence
(BR-FIN-025). Cada tela media o crédito de um jeito:

| Tela | Como contava o crédito |
|---|---|
| Card "Gasto no crédito" e Ciclos | faturas que vencem no ciclo (certo) |
| Gráfico de crédito da visão geral | compra pelo valor total, dia a dia **do ciclo do salário** |
| Histórico (filtro Ciclo) | parcela pela data da compra; só a "a vencer" pelo vencimento |
| Análise / Categorias | compra pelo valor total na data, período padrão = ciclo do salário |

Uma compra de 10/09 (fatura 05/09–04/10, vence 10/10) entrava no card, mas não no gráfico nem no histórico do ciclo
25/09–24/10; uma de 06/10 aparecia nos dois, embora a fatura dela vença no ciclo seguinte. Além disso, Visão geral,
Histórico, Ciclos e Análise repetiam a mesma lista de lançamentos.

## Opções consideradas
| Opção | Prós | Contras |
|---|---|---|
| Manter cada tela com sua contagem e explicar na interface | Nada muda | O usuário vê números que não fecham entre si |
| **Regra única: crédito sempre pela fatura (escolhida)** | Card, gráfico, histórico, ciclos e relatórios fecham | Linhas de crédito podem ter data fora do ciclo em que pesam |
| Juntar todas as telas em uma só | Menos telas | Uma tela com quatro responsabilidades; pior no celular |

## Decisão
- **Vocabulário:** "Ciclo" é sempre o do salário; "Fatura" é o ciclo do cartão (abre, fecha, vence).
- **Regra (BR-FIN-039):** o que sai do saldo conta pela data, no ciclo em que saiu; o **crédito conta pela fatura** —
  dia a dia dentro do período da fatura e, no ciclo do salário, inteiro no ciclo em que vence.
- **Gráficos (web):** saldo por ciclo do salário; crédito pelo período da fatura (padrão: as faturas que vencem no ciclo
  ativo, as mesmas do card; ou a fatura aberta; ou De/Até livre). O último dia da "fatura acumulada" é o card.
- **Uma responsabilidade por tela** (web e app):
  - **Hoje / Visão geral:** como estou agora;
  - **Histórico:** a única lista de lançamentos, com edição e filtros Ciclo, Fatura, Cartão, Categoria, Tipo e De/Até;
    as outras telas apontam para ela já filtrada (`/historico?ciclo=&cartao=&fatura=&categoria=&tipo=&de=&ate=`);
  - **Cartões:** sai de Ajustes para o menu principal; mantém a composição de cada fatura, porque é ali que se paga;
  - **Relatórios:** junta Ciclos e Análise e ganha **Crédito** (faturas por mês, período, vencimento e ciclo em que pesam);
  - **Ajustes:** configuração, categorias (no app, a criação saiu da aba Categorias) e exportação.
- **Rotas antigas** do web redirecionam: `/ciclos` e `/ciclos/:id` → `/relatorios/ciclos…`, `/analise` →
  `/relatorios/categorias`, `/ajustes/cartoes…` → `/cartoes…`.

## Consequências
- `selectPaidHistory` passa `cycleId` do crédito para o ciclo do vencimento e expõe `statementKey`/`dueDate`; a fatura que
  vence num ciclo ainda não aberto fica sem ciclo ("Ciclo a abrir" no web; "Nas próximas faturas" no app).
- O núcleo ganha `credit-series` (período do cartão e séries diárias de saldo e crédito), `credit-report` e
  `selectCycleCategorizedItems`; nenhuma regra nova no navegador nem no app.
- Sem migration e sem mudança de contrato remoto.
