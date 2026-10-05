import { addCardPurchase, saveCreditCard } from './card.use-cases';
import {
  describeCycleWeight,
  describeFirstInstallment,
  describeInstallmentSchedule,
  describeStatementComposition,
  describeStatementEntry,
  formatMonthKey,
  knownItemsTotal,
} from './card-text';
import {
  buildCardStatementsView,
  describeCycleStatements,
  formatDayMonth,
  hasCardPurchases,
  statementCycleKeys,
  weightByCycle,
} from './card-view';
import { openCycle, saveConfig } from './cycle.use-cases';
import { selectCardStatements, selectCreditCards } from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';

let sequence = 0;
const at = (day: number, month = 10): UseCaseContext => ({
  now: new Date(2026, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});

function fixture(): LocalState {
  let state = saveConfig(
    createEmptyState(),
    {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 7 }],
      savingGoal: 0,
      customCategories: [],
      fixedExpenses: [],
    },
    at(7),
  );
  state = openCycle(state, at(7));
  state = saveCreditCard(state, { name: 'Nubank', closingDay: 5, dueDay: 15 }, at(8));
  state = addCardPurchase(
    state,
    {
      cardId: state.creditCards[0]!.id,
      description: 'TV',
      category: 'Lazer',
      totalAmount: 30000,
      installments: 3,
      date: '2026-10-08',
    },
    at(8),
  );
  return state;
}

describe('card-view', () => {
  const state = fixture();
  const card = selectCreditCards(state)[0]!;
  const today = new Date(2026, 9, 10, 12);
  const statements = selectCardStatements(state, card.id, today);

  it('organiza a fatura atual, a próxima e as futuras', () => {
    const cycleId = state.cycles[0]!.id;
    const view = buildCardStatementsView(card, statements, today, cycleId);

    expect(view.current.amount).toBe(10000);
    expect(view.next.amount).toBe(10000);
    expect(view.future.length).toBeGreaterThan(0);
    expect(view.paidInActiveCycle).toEqual([]);
  });

  it('peso por ciclo soma as parcelas a partir do ciclo ativo', () => {
    const weights = weightByCycle(statements, '2026-10');

    expect(weights.map((item) => item.amount)).toEqual([10000, 10000, 10000]);
    expect(weightByCycle(statements, '2026-12')).toHaveLength(2);
  });

  it('ciclos em que a fatura pesa: pelas parcelas ou estimado pelo vencimento', () => {
    const withInstallments = statements.find((s) => s.installments.length > 0)!;

    expect(statementCycleKeys(withInstallments, card, 7, '2026-10')).toHaveLength(1);
    expect(statementCycleKeys({ ...withInstallments, installments: [] }, card, null, null)).toEqual(
      [],
    );
    expect(
      statementCycleKeys({ ...withInstallments, installments: [] }, card, 7, '2026-10').length,
    ).toBe(1);
  });

  it('datas e cartão com compras', () => {
    expect(formatDayMonth('2026-10-15')).toBe('15/10');
    expect(hasCardPurchases(state, card.id)).toBe(true);
    expect(hasCardPurchases(state, 'outro')).toBe(false);
  });
});

describe('card-text', () => {
  it('descreve parcelas, ciclos e lançamentos de fatura', () => {
    expect(describeFirstInstallment(0)).toMatch(/neste ciclo/);
    expect(describeFirstInstallment(1)).toMatch(/próximo/);
    expect(describeFirstInstallment(3)).toMatch(/3 ciclos/);
    expect(formatMonthKey('2026-10')).toBe('10/2026');
    expect(describeCycleWeight([])).toBe('');
    expect(describeCycleWeight(['2026-11', '2026-10', '2026-11'])).toBe(
      'pesa no ciclo de 10/2026 e 11/2026',
    );
    expect(describeInstallmentSchedule(1, 'R$ 10,00', '2026-10', '2026-10')).toMatch(/1 parcela/);
    expect(describeInstallmentSchedule(3, 'R$ 10,00', '2026-10', '2026-12')).toMatch(/3 parcelas/);
    expect(describeStatementEntry({ paidAmount: 1000, charges: 0 }, '10/10')).toMatch(/Pagamento/);
    expect(describeStatementEntry({ paidAmount: 0, charges: 500 }, '10/10')).toMatch(/Juros/);
    expect(describeStatementEntry({ paidAmount: 1000, charges: 500 }, '10/10')).toMatch(/encargos/);
  });

  it('composição do total informado nunca inventa itens', () => {
    expect(describeStatementComposition(10000, 0)).toMatch(/^Total informado R\$\s100,00$/);
    expect(describeStatementComposition(10000, 4000)).toMatch(/não detalhado/);
    expect(
      knownItemsTotal({
        installments: [
          { includedInBalance: true, nominalAmount: 300 },
          { includedInBalance: false, nominalAmount: 900 },
        ] as never,
      }),
    ).toBe(300);
  });
});

describe('describeCycleStatements (BR-FIN-037)', () => {
  const statement = { openDate: '2026-09-06', closingDate: '2026-10-05', dueDate: '2026-10-10' };

  it('descreve nenhuma, uma ou várias faturas do ciclo', () => {
    expect(describeCycleStatements([])).toBe('Nenhuma fatura vence neste ciclo.');
    expect(describeCycleStatements([statement])).toBe('Fatura 06/09 a 05/10, vence 10/10.');
    expect(describeCycleStatements([statement, statement])).toBe('2 faturas vencem neste ciclo.');
  });
});
