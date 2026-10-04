import { CardPurchase } from './credit-card';
import { projectCycles, projectFixedExpenseAmount } from './projection';

const purchase: CardPurchase = {
  id: 'p1',
  cardId: 'k1',
  description: 'TV',
  category: 'Casa',
  totalAmount: 30000,
  installments: 3,
  purchaseDate: '2026-10-22',
  firstStatementKey: '2026-11',
  firstCycleKey: '2026-11',
  settledInstallments: 0,
  createdAt: '2026-10-22T12:00:00.000Z',
};

describe('projeção dos próximos ciclos (BR-FIN-031)', () => {
  it('livre antes de novos gastos = renda ativa − meta − fixas ativas − faturas', () => {
    const projections = projectCycles(
      {
        incomeSources: [
          { id: 'a', name: 'Salário', amount: 500000, payday: 5 },
          { id: 'b', name: 'Antiga', amount: 80000, payday: 10, active: false },
        ],
        savingGoal: 100000,
        fixedExpenses: [
          { id: 'f1', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 150000 },
          {
            id: 'f2',
            type: 'permanent',
            name: 'Academia',
            category: 'Saúde',
            amount: 9000,
            active: false,
          },
          {
            id: 'f3',
            type: 'installment',
            name: 'Carnê',
            category: 'Casa',
            installmentAmount: 20000,
            totalInstallments: 5,
            remainingInstallments: 2,
            startedAtCycleId: 'c1',
          },
        ],
      },
      [purchase],
      '2026-10',
      4,
    );

    expect(projections).toEqual([
      {
        cycleKey: '2026-11',
        cyclesAhead: 1,
        income: 500000,
        savingGoal: 100000,
        fixedExpenses: 170000,
        cardCharges: 10000,
        free: 220000,
      },
      {
        cycleKey: '2026-12',
        cyclesAhead: 2,
        income: 500000,
        savingGoal: 100000,
        fixedExpenses: 150000,
        cardCharges: 10000,
        free: 240000,
      },
      {
        cycleKey: '2027-01',
        cyclesAhead: 3,
        income: 500000,
        savingGoal: 100000,
        fixedExpenses: 150000,
        cardCharges: 10000,
        free: 240000,
      },
      {
        cycleKey: '2027-02',
        cyclesAhead: 4,
        income: 500000,
        savingGoal: 100000,
        fixedExpenses: 150000,
        cardCharges: 0,
        free: 250000,
      },
    ]);
  });

  it('parcelamento ainda não iniciado começa a contar no próximo ciclo', () => {
    const notStarted = {
      id: 'f',
      type: 'installment' as const,
      name: 'X',
      category: 'Outros',
      installmentAmount: 100,
      totalInstallments: 2,
      remainingInstallments: 2,
    };

    expect([1, 2, 3].map((ahead) => projectFixedExpenseAmount(notStarted, ahead))).toEqual([
      100, 100, 0,
    ]);
  });
});
