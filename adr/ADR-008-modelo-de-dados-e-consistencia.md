# ADR-008 — Modelo de dados e consistência

- **Status:** ACCEPTED · **Fase:** F3 · **Data:** 2026-10-01
- **Referencia:** ADR-003 (documento local), ADR-004 (sync)

## Contexto

O estado local hoje aninha os gastos dentro do mês (`FinancialMonth.expenses`). O sync precisa de
entidades endereçáveis individualmente, com metadados próprios. Operações de ciclo alteram várias
entidades ao mesmo tempo. O recebimento antecipado, por exemplo, fecha um ciclo, abre outro, move
gastos e avança parcelas.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Sincronizar o documento inteiro como JSON | Trivial | Conflito por documento; tráfego alto; sem RLS por linha útil |
| **Entidades normalizadas** (`settings`, `fixed_expenses`, `cycles`, `expenses`) | Conflito por registro; pull incremental; constraints no servidor | Exige mapeamento e ordem de push |
| Event sourcing (log de comandos) | Auditoria perfeita | Complexidade desproporcional |

## Decisão

1. **Entidades normalizadas** local e remotamente ([contracts.md](../docs/architecture/contracts.md)).
   O domínio continua recebendo `FinancialMonth` com `expenses`, montado por seletores.
2. **Consistência:**
   - **Local:** forte. Cada caso de uso produz o próximo estado completo, gravado de forma atômica
     (ADR-003).
   - **Entre aparelhos:** **eventual**. Operações com várias entidades chegam ao servidor em mais de
     uma requisição. Por alguns segundos, outro aparelho pode ver um estado intermediário (por
     exemplo, ciclo fechado sem o novo ciclo ativo). O outbox garante a convergência.
3. **Fronteiras transacionais:**

| Operação | Entidades alteradas | Local | Servidor |
|---|---|---|---|
| Salvar configuração | settings, fixed_expenses, ciclo ativo | 1 escrita | eventual |
| Abrir ciclo | fixed_expenses (avanço), cycles | 1 escrita | eventual; índice único protege BR-FIN-013 |
| Receber antecipado | cycles (fecha + abre), expenses (move), fixed_expenses | 1 escrita | eventual; `closed` antes de `active` |
| Fechar ciclo | cycles | 1 escrita | atômico (1 linha) |
| Criar, editar ou excluir gasto | expenses | 1 escrita | atômico (1 linha) |

4. **Idempotência (BR-SYNC-003):** IDs gerados no cliente + `upsert` tornam todo push reaplicável.

## Trade-offs

- A janela de inconsistência entre aparelhos é aceita, por ser single-user e de baixa concorrência.

## Consequências

- `src/application/` opera sobre `LocalStateV2`; seletores (`selectActiveMonth`, `selectMonths`)
  montam os tipos de domínio.
- Testes do sync cobrem a ordenação `closed → active` e a resolução de `23505`.

## Relações

BR-FIN-010, BR-FIN-013, BR-SYNC-001..003, RNF-03
