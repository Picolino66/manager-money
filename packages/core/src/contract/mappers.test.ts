import {
  CardPurchaseRecord,
  CreditCardRecord,
  CycleRecord,
  ExpenseRecord,
  ExtraIncomeRecord,
  FixedExpenseRecord,
  FixedPaymentRecord,
  SettingsRecord,
  StatementPaymentRecord,
} from '../application/state';
import {
  extraIncomeFromRow,
  extraIncomeToRow,
  fixedPaymentFromRow,
  fixedPaymentToRow,
  cardPurchaseFromRow,
  cardPurchaseToRow,
  creditCardFromRow,
  creditCardToRow,
  cycleFromRow,
  cycleToRow,
  expenseFromRow,
  expenseToRow,
  fixedExpenseFromRow,
  fixedExpenseToRow,
  settingsFromRow,
  settingsToRow,
  statementPaymentFromRow,
  statementPaymentToRow,
} from './mappers';
import { mapSupabaseError } from './errors';

const meta = { updatedAt: '2026-10-10T12:00:00.000Z', deletedAt: null, dirty: false };

describe('mappers (contracts.md §2): ida e volta sem perda', () => {
  it('settings', () => {
    const record: SettingsRecord = {
      ...meta,
      monthlyIncome: 100,
      incomeSources: [{ id: 'i1', name: 'Salário', amount: 100, payday: 7 }],
      savingGoal: 5,
      payday: 10,
      customCategories: ['Viagem'],
    };
    const row = settingsToRow(record, 'u');
    expect(row).toMatchObject({
      user_id: 'u',
      monthly_income: 100,
      payday: 10,
      client_updated_at: meta.updatedAt,
    });
    expect(settingsFromRow(row)).toEqual(record);
  });

  it('settings de linha antiga (sem income_sources) vira uma fonte "Renda" (BR-FIN-018)', () => {
    const row = {
      user_id: 'u',
      monthly_income: 880000,
      saving_goal: 0,
      payday: 7,
      custom_categories: [],
      client_updated_at: meta.updatedAt,
      deleted_at: null,
    };
    expect(settingsFromRow(row).incomeSources).toEqual([
      { id: 'income-legacy', name: 'Renda', amount: 880000, payday: 7 },
    ]);
    expect(settingsFromRow({ ...row, income_sources: [] }).incomeSources).toHaveLength(1);
    // BR-FIN-024: fonte sem dia herda o dia da linha; com dia, mantém o próprio.
    expect(
      settingsFromRow({
        ...row,
        payday: 9,
        income_sources: [
          { id: 'a', name: 'A', amount: 1 },
          { id: 'b', name: 'B', amount: 2, payday: 20 },
        ],
      }).incomeSources.map((source) => source.payday),
    ).toEqual([9, 20]);
  });

  it('cartão de crédito e compra no cartão (BR-FIN-019)', () => {
    const card: CreditCardRecord = {
      ...meta,
      id: 'k1',
      name: 'Nubank',
      closingDay: 25,
      dueDay: 5,
      creditLimit: 600000,
      active: true,
    };
    const cardRow = creditCardToRow(card, 'u');
    expect(cardRow).toMatchObject({ user_id: 'u', closing_day: 25, due_day: 5 });
    expect(creditCardFromRow(cardRow)).toEqual(card);

    const purchase: CardPurchaseRecord = {
      ...meta,
      id: 'p1',
      cardId: 'k1',
      description: 'Notebook',
      category: 'Educação',
      totalAmount: 300000,
      installments: 3,
      purchaseDate: '2026-10-20',
      firstStatementKey: '2026-10',
      firstCycleKey: '2026-10',
      settledInstallments: 0,
      createdAt: '2026-10-20T12:00:00.000Z',
    };
    const purchaseRow = cardPurchaseToRow(purchase, 'u');
    expect(purchaseRow).toMatchObject({
      card_id: 'k1',
      total_amount: 300000,
      first_cycle_key: '2026-10',
      first_statement_key: '2026-10',
      settled_installments: 0,
    });
    expect(cardPurchaseFromRow(purchaseRow)).toEqual(purchase);
  });

  it('linhas antigas de cartão e compra recebem padrões compatíveis (ADR-017)', () => {
    const {
      credit_limit: _limit,
      active: _active,
      ...oldCard
    } = creditCardToRow(
      {
        ...meta,
        id: 'k1',
        name: 'Nubank',
        closingDay: 25,
        dueDay: 5,
        creditLimit: null,
        active: true,
      },
      'u',
    );
    expect(creditCardFromRow(oldCard)).toMatchObject({ creditLimit: null, active: true });

    const oldPurchase = {
      user_id: 'u',
      id: 'p1',
      card_id: 'k1',
      description: 'Notebook',
      category: 'Outros',
      total_amount: 1000,
      installments: 1,
      purchase_date: '2026-10-28',
      first_cycle_key: '2026-11',
      created_at: '2026-10-28T12:00:00.000Z',
      client_updated_at: '2026-10-28T12:00:00.000Z',
      deleted_at: null,
    };
    // Sem a coluna nova, a fatura deriva da data e do fechamento do cartão (28/10 > 25 → fatura de novembro).
    expect(cardPurchaseFromRow(oldPurchase, () => 25)).toMatchObject({
      firstStatementKey: '2026-11',
      settledInstallments: 0,
    });
  });

  it('pagamento de fatura (BR-FIN-026)', () => {
    const payment: StatementPaymentRecord = {
      ...meta,
      id: 'sp1',
      cardId: 'k1',
      statementKey: '2026-10',
      cycleId: 'c1',
      statementAmount: 10000,
      paidAmount: 10500,
      charges: 500,
      paidAt: '2026-11-08',
    };
    const row = statementPaymentToRow(payment, 'u');
    expect(row).toMatchObject({ card_id: 'k1', statement_key: '2026-10', paid_amount: 10500 });
    expect(statementPaymentFromRow(row)).toEqual(payment);
  });

  it('pagamento de despesa fixa (à vista e no crédito) e renda avulsa (BR-FIN-021..023)', () => {
    const cash: FixedPaymentRecord = {
      ...meta,
      id: 'pay1',
      cycleId: 'c1',
      fixedExpenseId: 'aluguel',
      name: 'Aluguel',
      category: 'Moradia',
      method: 'pix',
      amount: 150000,
      interest: 0,
      paidAt: '2026-10-11',
    };
    const cashRow = fixedPaymentToRow(cash, 'u');
    expect(cashRow).toMatchObject({ method: 'pix', card_purchase_id: null, paid_at: '2026-10-11' });
    expect(fixedPaymentFromRow(cashRow)).toEqual(cash);

    const credit: FixedPaymentRecord = {
      ...cash,
      id: 'pay2',
      method: 'credit',
      interest: 5000,
      cardPurchaseId: 'p1',
    };
    expect(fixedPaymentToRow(credit, 'u')).toMatchObject({
      method: 'credit',
      interest: 5000,
      card_purchase_id: 'p1',
    });
    expect(fixedPaymentFromRow(fixedPaymentToRow(credit, 'u'))).toEqual(credit);

    const income: ExtraIncomeRecord = {
      ...meta,
      id: 'inc1',
      cycleId: 'c1',
      name: 'Freela',
      amount: 50000,
      date: '2026-10-15',
    };
    expect(extraIncomeFromRow(extraIncomeToRow(income, 'u'))).toEqual(income);
  });

  it('despesa fixa permanente e parcelamento', () => {
    const permanent: FixedExpenseRecord = {
      ...meta,
      id: 'p',
      type: 'permanent',
      name: 'Aluguel',
      category: 'Moradia',
      amount: 100,
    };
    const installment: FixedExpenseRecord = {
      ...meta,
      id: 'i',
      type: 'installment',
      name: 'TV',
      category: 'Lazer',
      installmentAmount: 50,
      totalInstallments: 3,
      remainingInstallments: 2,
      startedAtCycleId: 'c1',
    };
    expect(fixedExpenseToRow(permanent, 'u')).toMatchObject({
      kind: 'permanent',
      amount: 100,
      installment_amount: null,
    });
    expect(fixedExpenseFromRow(fixedExpenseToRow(permanent, 'u'))).toEqual(permanent);
    // ADR-023: cartão da fixa recorrente vai e volta; ausente grava nulo e não reaparece.
    expect(fixedExpenseToRow(permanent, 'u').recurring_card_id).toBeNull();
    const recurring = { ...permanent, recurringCardId: 'k1' };
    expect(fixedExpenseToRow(recurring, 'u').recurring_card_id).toBe('k1');
    expect(fixedExpenseFromRow(fixedExpenseToRow(recurring, 'u'))).toEqual(recurring);
    expect(fixedExpenseFromRow(fixedExpenseToRow(permanent, 'u'))).not.toHaveProperty(
      'recurringCardId',
    );
    expect(fixedExpenseFromRow(fixedExpenseToRow(installment, 'u'))).toEqual(installment);
    const notStarted = { ...installment, startedAtCycleId: undefined };
    expect(fixedExpenseToRow(notStarted, 'u').started_at_cycle_id).toBeNull();
    expect(fixedExpenseFromRow(fixedExpenseToRow(notStarted, 'u'))).not.toHaveProperty(
      'startedAtCycleId',
    );
  });

  it('ciclo ativo e fechado', () => {
    const active: CycleRecord = {
      ...meta,
      id: 'c1',
      startDate: '2026-10-07',
      endDate: '2026-11-06',
      receivedAt: '2026-10-07T03:00:00.000Z',
      startedAt: '2026-10-07T03:00:00.000Z',
      status: 'active',
      initialAvailableAmount: 1000,
      previousMonthDebt: 0,
    };
    const closed: CycleRecord = {
      ...active,
      status: 'closed',
      closedAt: '2026-11-07T00:00:00.000Z',
      finalBalance: -20,
    };
    expect(cycleToRow(active, 'u')).toMatchObject({ closed_at: null, final_balance: null });
    expect(cycleFromRow(cycleToRow(active, 'u'))).toEqual(active);
    expect(cycleFromRow(cycleToRow(closed, 'u'))).toEqual(closed);
  });

  it('gasto, incluindo exclusão lógica', () => {
    const expense: ExpenseRecord = {
      ...meta,
      deletedAt: '2026-10-11T00:00:00.000Z',
      id: 'e',
      cycleId: 'c1',
      amount: 250,
      category: 'Outros',
      description: 'Café',
      date: '2026-10-10',
      createdAt: '2026-10-10T10:00:00.000Z',
    };
    expect(expenseToRow(expense, 'u')).toMatchObject({
      cycle_id: 'c1',
      deleted_at: expense.deletedAt,
    });
    expect(expenseFromRow(expenseToRow(expense, 'u'))).toEqual(expense);
  });
});

describe('mapSupabaseError', () => {
  it('classifica erros do PostgREST', () => {
    expect(
      mapSupabaseError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "cycles_one_active_per_user"',
      }).code,
    ).toBe('conflict-active-cycle');
    expect(mapSupabaseError({ code: '23505', message: 'outra' }).code).toBe('unknown');
    expect(mapSupabaseError({ code: 'PGRST301', message: 'JWT expired' }).code).toBe('auth');
    expect(mapSupabaseError({ code: '', message: 'TypeError: Network request failed' }).code).toBe(
      'network',
    );
  });
});
