---
id: architecture.contracts
type: integration
module: architecture
title: Contratos de dados e API (v1)
summary: >
  Schema remoto Supabase, operações PostgREST e RPC usadas pelo sync, DTOs de linha e documento
  local versionado (schemaVersion 6).
code:
  - supabase/migrations/20261001000000_init.sql
  - supabase/migrations/20261003000000_income_sources.sql
  - supabase/migrations/20261003000100_credit_cards.sql
  - supabase/migrations/20261003000200_fixed_payments_and_incomes.sql
  - src/infrastructure/storage/schema.ts
  - src/infrastructure/sync/supabase-remote.ts
  - src/infrastructure/sync/mappers.ts
adrs: [ADR-003, ADR-004, ADR-008]
last_verified_commit: 6fd4838+T-021
---

# Contratos de dados e API — v1

**Versão do contrato:** `v1`. Fonte canônica do schema remoto:
[`supabase/migrations/20261001000000_init.sql`](../../supabase/migrations/20261001000000_init.sql).
Qualquer mudança incompatível exige nova migration e um `CONTRACT_VERSION` novo no cliente
(nunca alterar uma migration já aplicada).

## 1. Modelo de entidades

```
auth.users 1─1 settings
auth.users 1─N fixed_expenses
auth.users 1─N credit_cards 1─N card_purchases
auth.users 1─N cycles 1─N expenses
cycles 1─N fixed_payments
cycles 1─N extra_incomes
```

| Entidade | Chave | Regras garantidas no servidor |
|---|---|---|
| `settings` | `user_id` | valores ≥ 0; `payday` entre 1 e 28 (BR-FIN-002); até 50 categorias |
| `fixed_expenses` | `(user_id, id)` | forma por `kind`; `remaining ≤ total` (BR-FIN-010) |
| `credit_cards` | `(user_id, id)` | nome 1–40; `closing_day` e `due_day` entre 1 e 28 (BR-FIN-019) |
| `card_purchases` | `(user_id, id)` | `total_amount > 0` (com juros); 1–48 parcelas; `first_cycle_key` `yyyy-MM`; FK para o cartão (BR-FIN-019/020) |
| `fixed_payments` | `(user_id, id)` | `method` ∈ pix/cash/debit/credit; crédito exige `card_purchase_id`, outros não têm juros; **um pagamento vigente por `(cycle_id, fixed_expense_id)`** (BR-FIN-021/022) |
| `extra_incomes` | `(user_id, id)` | `amount > 0`; FK para o ciclo (BR-FIN-023) |
| `cycles` | `(user_id, id)` | `end ≥ start`; forma `active`/`closed`; **um ativo por usuário** (BR-FIN-013) |
| `expenses` | `(user_id, id)` | `amount > 0` (BR-FIN-001); FK para o ciclo; tamanho dos textos |

Campos comuns de sync: `client_updated_at` (relógio do cliente), `server_updated_at` (trigger,
cursor de pull), `deleted_at` (exclusão lógica).

## 2. DTOs (linha remota ↔ registro local)

Valores monetários são `bigint` em centavos no banco e `number` inteiro no cliente
(seguro até 2^53). Datas de calendário são `date` (`yyyy-MM-dd`); instantes são `timestamptz` ISO-8601.

| Remoto (snake_case) | Local (camelCase) | Tipo |
|---|---|---|
| `settings.monthly_income` | `settings.monthlyIncome` | centavos; **soma de `incomeSources`** (derivado) |
| `settings.income_sources` | `settings.incomeSources` | `{ id, name, amount, payday }[]` (jsonb, até 20; BR-FIN-018/024). Linha sem fontes (`[]`) vira uma fonte "Renda" com `monthly_income`; fonte sem `payday` herda `settings.payday` |
| `settings.saving_goal` | `settings.savingGoal` | centavos |
| `settings.payday` | `settings.payday` | 1–28; **derivado**: dia da fonte de maior valor (BR-FIN-024) |
| `settings.custom_categories` | `settings.customCategories` | `string[]` |
| `fixed_expenses.kind` | `fixedExpense.type` | `'permanent' \| 'installment'` |
| `fixed_expenses.amount` | `fixedExpense.amount` (permanent) | centavos |
| `fixed_expenses.installment_amount` | `fixedExpense.installmentAmount` | centavos |
| `fixed_expenses.total_installments` / `remaining_installments` | idem camelCase | inteiros |
| `fixed_expenses.started_at_cycle_id` | `fixedExpense.startedAtCycleId` | `string \| undefined` |
| `credit_cards.closing_day` / `due_day` | `creditCard.closingDay` / `dueDay` | 1–28 |
| `card_purchases.card_id` / `total_amount` / `installments` | `cardPurchase.cardId` / `totalAmount` / `installments` | centavos com juros; 1–48 |
| `card_purchases.purchase_date` / `first_cycle_key` | `purchaseDate` / `firstCycleKey` | `yyyy-MM-dd` / `yyyy-MM` (início do ciclo da 1ª parcela) |
| `fixed_payments.fixed_expense_id` / `method` / `amount` / `interest` | `fixedPayment.fixedExpenseId` / `method` / `amount` / `interest` | id lógico; `pix\|cash\|debit\|credit`; centavos (valor da fixa e juros) |
| `fixed_payments.paid_at` / `card_purchase_id` | `paidAt` / `cardPurchaseId?` | `yyyy-MM-dd` / compra criada no crédito |
| `extra_incomes.*` | `extraIncome.*` | `name`, `amount` (centavos), `date`, `cycleId` |
| `cycles.*` | `cycle.*` (`FinancialMonth` sem `expenses`) | — |
| `expenses.cycle_id` | `expense.cycleId` | `string` |
| `*.client_updated_at` | `*.updatedAt` | ISO |
| `*.deleted_at` | `*.deletedAt` | ISO \| `null` |

O mapeamento é implementado e testado em `src/infrastructure/sync/mappers.ts`.

## 3. Operações (porta `SyncRemote`)

| Operação | Chamada Supabase | Observações |
|---|---|---|
| `pushSettings(row)` | `from('settings').upsert(row, { onConflict: 'user_id' })` | — |
| `push(table, rows)` | `from(table).upsert(rows, { onConflict: 'user_id,id' })` | Ordem: `settings` → `fixed_expenses` → `credit_cards` → `cycles` → `expenses` → `card_purchases` → `fixed_payments` → `extra_incomes`. Em `cycles`, linhas `closed` vão **antes** de `active` (o índice único é verificado linha a linha) |
| `pull(table, cursor)` | `from(table).select('*').gt('server_updated_at', cursor − 5s).order('server_updated_at').limit(500)` | A janela de 5 s cobre commits concorrentes fora de ordem; aplicar o mesmo registro duas vezes não muda o resultado. Pagina até vir < 500 |
| `hasRemoteData()` | `from('cycles').select('id', { head: true, count: 'exact' })` + `settings` | Usado no primeiro login (BR-ACC-002) |
| `replaceRemoteWithLocal()` | `update({ deleted_at: now })` em todas as linhas não excluídas, seguido de `push` | Opção "manter dados deste aparelho" |
| `deleteAccount()` | `rpc('delete_my_account')` | Remove usuário e dados em cascata (BR-ACC-003) |

### Erros tratados

| Código Postgres | Significado | Ação no cliente |
|---|---|---|
| `23505` em `cycles_one_active_per_user` | Outro aparelho abriu um ciclo ativo | Pull; adota o ciclo do servidor; reatribui os gastos locais; exclui logicamente o ciclo local (ADR-004 §4) |
| `42501` / JWT expirado | Sessão inválida | Tenta refresh; se falhar, marca `sync.lastError = 'auth'` e pede novo login |
| rede / 5xx | Indisponível | Mantém o outbox; backoff exponencial de 2 s a 60 s |

## 4. Documento local — `@manager-money/state` (schemaVersion 6)

```ts
type SyncMeta = { updatedAt: string; deletedAt: string | null; dirty: boolean };

type LocalStateV6 = {
  schemaVersion: 6;
  settings: (Settings & SyncMeta) | null;          // monthlyIncome, incomeSources, savingGoal, payday, customCategories
  fixedExpenses: Array<FixedExpense & SyncMeta>;
  creditCards: Array<CreditCard & SyncMeta>;
  cycles: Array<Cycle & SyncMeta>;                 // FinancialMonth sem expenses
  expenses: Array<Expense & { cycleId: string } & SyncMeta>;
  cardPurchases: Array<CardPurchase & SyncMeta>;
  fixedPayments: Array<FixedExpensePayment & SyncMeta>;
  extraIncomes: Array<ExtraIncome & SyncMeta>;
  sync: {
    userId: string | null;
    cursors: Record<'settings' | 'fixed_expenses' | 'credit_cards' | 'cycles' | 'expenses' | 'card_purchases' | 'fixed_payments' | 'extra_incomes', string | null>;
    lastSyncAt: string | null;
    lastError: string | null;
  };
};
```

- Gravado em um único `setItem` (ADR-003). Validado por Zod na leitura.
- **Migração v1 → v2:** lê as três chaves `@daily-budget/*`, aplica a normalização legada
  (fixos numéricos, ciclos por mês de calendário), atribui `cycleId` aos gastos, marca tudo como
  `dirty: true` e `payday: 7`, grava a v2 e só então remove as chaves v1.
- **Migração v2 → v3:** `settings.monthlyIncome` vira a fonte `{ id: 'income-legacy', name: 'Renda' }`
  e `settings` fica `dirty: true` para levar `income_sources` ao servidor (ADR-013).
- **Migração v3 → v4:** acrescenta `creditCards: []`, `cardPurchases: []` e os cursores
  `credit_cards` e `card_purchases` (ADR-014). Migrações v2 → v3 → v4 encadeiam em `migrateDocument`.
- **Migração v4 → v5 (ADR-015):** acrescenta `fixedPayments: []`, `extraIncomes: []` e os cursores
  `fixed_payments` e `extra_incomes`; devolve ao `initialAvailableAmount` do ciclo ativo o total das
  despesas fixas ativas que a v4 já havia descontado (ciclo marcado `dirty`). `migrateDocument` encadeia v2 → v3 → v4 → v5.
- **Migração v5 → v6 (ADR-016):** cada fonte de renda recebe `payday` = `settings.payday` atual e `settings`
  fica `dirty`. `migrateDocument` encadeia v2 → … → v6.
- Um documento que falha na validação **não é sobrescrito**: o app mostra um erro de carregamento
  com a opção de exportar o conteúdo bruto (DEF-004).
