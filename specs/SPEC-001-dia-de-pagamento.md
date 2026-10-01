---
spec: SPEC-001
features: [planning.payday]
---
# SPEC-001 — Dia de pagamento configurável

## Objetivo
Permitir que qualquer pessoa alinhe o ciclo financeiro ao próprio dia de pagamento (bloqueador de lançamento público, DEF-009).

## Docs relacionados
[business-rules](../docs/business/business-rules.md) · [requirements](../docs/business/requirements.md)

## Requisitos relacionados
RF-12, DEF-009 · BR-FIN-002, BR-FIN-003

## Regras
- `payday` é um inteiro entre 1 e 28 (evita meses curtos). Padrão: 7 (compatível com o MVP).
- **Início padrão** do ciclo para a data D: `payday` do mês de D se `dia(D) ≥ payday`; senão, `payday` do mês anterior.
- **Fim** do ciclo que começa em S: (dia `payday` do mês seguinte ao mês de S) − 1 dia. A fórmula vale para início normal e antecipado.
- Com `payday = 1`, o ciclo é o mês civil e não há janela de recebimento antecipado.
- Alterar o `payday` **não** altera o ciclo ativo; vale a partir do próximo ciclo.

## Comportamento
- Campo "Dia do pagamento" na Configuração, com teclado numérico e erro "Informe um dia entre 1 e 28."
- O texto "antes do dia 7" do README e dos alertas passa a usar o dia configurado.

## Fluxos
FLOW-primeiro-uso, passo 2.

## Critérios de aceite
- [ ] `payday = 7`: datas idênticas às do MVP (testes de regressão existentes passam).
- [ ] `payday = 1`: início em 01/04 → fim em 30/04; `canReceiveIncomeEarly` é sempre falso.
- [ ] `payday = 15`: em 10/04 o início padrão é 15/03 e o fim é 14/04.
- [ ] `payday = 28`: início em 28/01 → fim em 27/02.
- [ ] Valor fora de 1–28 é rejeitado pelo formulário e pelo schema.

## Tasks derivadas
T-004
