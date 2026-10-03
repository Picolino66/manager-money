import {
  CardPurchaseRecord,
  CreditCardRecord,
  CycleRecord,
  ExpenseRecord,
  FixedExpenseRecord,
  SettingsRecord,
} from '../../application/state';
import {
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
} from './mappers';
import { mapSupabaseError, pullSince } from './supabase-remote';

const meta = { updatedAt: '2026-10-10T12:00:00.000Z', deletedAt: null, dirty: false };

describe('mappers (contracts.md §2): ida e volta sem perda', () => {
  it('settings', () => {
    const record: SettingsRecord = { ...meta, monthlyIncome: 100, incomeSources: [{ id: 'i1', name: 'Salário', amount: 100 }], savingGoal: 5, payday: 10, customCategories: ['Viagem'] };
    const row = settingsToRow(record, 'u');
    expect(row).toMatchObject({ user_id: 'u', monthly_income: 100, payday: 10, client_updated_at: meta.updatedAt });
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
      { id: 'income-legacy', name: 'Renda', amount: 880000 },
    ]);
    expect(settingsFromRow({ ...row, income_sources: [] }).incomeSources).toHaveLength(1);
  });

  it('cartão de crédito e compra no cartão (BR-FIN-019)', () => {
    const card: CreditCardRecord = { ...meta, id: 'k1', name: 'Nubank', closingDay: 25, dueDay: 5 };
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
      firstCycleKey: '2026-10',
      createdAt: '2026-10-20T12:00:00.000Z',
    };
    const purchaseRow = cardPurchaseToRow(purchase, 'u');
    expect(purchaseRow).toMatchObject({ card_id: 'k1', total_amount: 300000, first_cycle_key: '2026-10' });
    expect(cardPurchaseFromRow(purchaseRow)).toEqual(purchase);
  });

  it('despesa fixa permanente e parcelamento', () => {
    const permanent: FixedExpenseRecord = { ...meta, id: 'p', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 100 };
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
    expect(fixedExpenseToRow(permanent, 'u')).toMatchObject({ kind: 'permanent', amount: 100, installment_amount: null });
    expect(fixedExpenseFromRow(fixedExpenseToRow(permanent, 'u'))).toEqual(permanent);
    expect(fixedExpenseFromRow(fixedExpenseToRow(installment, 'u'))).toEqual(installment);
    const notStarted = { ...installment, startedAtCycleId: undefined };
    expect(fixedExpenseToRow(notStarted, 'u').started_at_cycle_id).toBeNull();
    expect(fixedExpenseFromRow(fixedExpenseToRow(notStarted, 'u'))).not.toHaveProperty('startedAtCycleId');
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
    const closed: CycleRecord = { ...active, status: 'closed', closedAt: '2026-11-07T00:00:00.000Z', finalBalance: -20 };
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
    expect(expenseToRow(expense, 'u')).toMatchObject({ cycle_id: 'c1', deleted_at: expense.deletedAt });
    expect(expenseFromRow(expenseToRow(expense, 'u'))).toEqual(expense);
  });
});

describe('SupabaseRemote: erros e cursor', () => {
  it('classifica erros do PostgREST', () => {
    expect(mapSupabaseError({ code: '23505', message: 'duplicate key value violates unique constraint "cycles_one_active_per_user"' }).code).toBe(
      'conflict-active-cycle',
    );
    expect(mapSupabaseError({ code: '23505', message: 'outra' }).code).toBe('unknown');
    expect(mapSupabaseError({ code: 'PGRST301', message: 'JWT expired' }).code).toBe('auth');
    expect(mapSupabaseError({ code: '', message: 'TypeError: Network request failed' }).code).toBe('network');
  });

  it('pull usa janela de 5 s antes do cursor', () => {
    expect(pullSince(null)).toBeNull();
    expect(pullSince('2026-10-10T12:00:05.000Z')).toBe('2026-10-10T12:00:00.000Z');
  });
});
