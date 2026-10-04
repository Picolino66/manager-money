/**
 * Lapidação das regras de cartão, fatura e compromissos (SPEC-019, ADR-018): os 13 cenários
 * obrigatórios, o transporte do restante de faturas parciais e as invariantes do domínio.
 *
 * Base: renda R$ 5.000 (dia 5), meta R$ 1.000, sem fixas; cartão com limite R$ 5.000, fecha dia 20
 * e vence dia 27. Hoje = 16/10/2026, ciclo 05/10–04/11 (saldo do ciclo R$ 4.000).
 */
import {
  addCardPurchase,
  addExistingCardDebt,
  addStatementCharges,
  deleteCardPurchase,
  payStatement,
  saveCreditCard,
  undoStatementPayment,
} from './card.use-cases';
import { closeCycle, openCycle, saveConfig } from './cycle.use-cases';
import {
  selectActiveCycle,
  selectActiveMonth,
  selectCardLimitUsage,
  selectCardStatements,
  selectClosedMonths,
  selectConfig,
  selectCycleProjections,
  selectUpcomingCommitments,
} from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';
import {
  calculateLimitExcess,
  listInstallments,
  splitInstallments,
} from '../domain/financial/credit-card';
import { buildDashboardSummary } from '../domain/financial/financial.calculations';
import { FinancialConfigInput } from '../domain/financial/financial.types';

let sequence = 0;
const at = (month: number, day: number, year = 2026): UseCaseContext => ({
  now: new Date(year, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});
const TODAY = at(10, 16);

const config: FinancialConfigInput = {
  incomeSources: [{ id: 'salario', name: 'Salário', amount: 500000, payday: 5 }],
  savingGoal: 100000,
  customCategories: [],
  fixedExpenses: [],
};

function base(ctx = TODAY): LocalState {
  const configured = saveConfig(createEmptyState(), config, ctx);

  return openCycle(
    saveCreditCard(
      configured,
      { name: 'Nubank', closingDay: 20, dueDay: 27, creditLimit: 500000 },
      ctx,
    ),
    ctx,
  );
}

const cardId = (state: LocalState) => state.creditCards[0]!.id;
const initial = (state: LocalState) => selectActiveCycle(state)!.initialAvailableAmount;
const limitOf = (state: LocalState) => selectCardLimitUsage(state, cardId(state))!;
const statementOf = (state: LocalState, key: string, ctx = TODAY) =>
  selectCardStatements(state, cardId(state), ctx.now).find((statement) => statement.key === key)!;
const buy = (state: LocalState, date: string, totalAmount: number, installments = 1, ctx = TODAY) =>
  addCardPurchase(
    state,
    {
      cardId: cardId(state),
      description: 'Compra',
      category: 'Pessoal',
      totalAmount,
      installments,
      date,
    },
    ctx,
  );
const pay = (state: LocalState, key: string, ctx: UseCaseContext, paidAmount?: number) =>
  payStatement(state, { cardId: cardId(state), statementKey: key, paidAmount }, ctx);
/** Fecha o ciclo de outubro e abre o de novembro (05/11). */
const nextCycle = (state: LocalState) => openCycle(closeCycle(state, at(11, 5)), at(11, 5));

beforeEach(() => {
  sequence = 0;
});

describe('cenários obrigatórios (SPEC-019)', () => {
  it('1. compra parcelada compromete o limite inteiro', () => {
    const state = buy(base(), '2026-10-16', 300000, 10);

    expect(limitOf(state)).toEqual({ creditLimit: 500000, committed: 300000, available: 200000 });
  });

  it('2. pagar a fatura com uma parcela libera só a parcela; a próxima libera mais uma', () => {
    const bought = buy(base(), '2026-10-16', 300000, 10);
    const firstPaid = pay(bought, '2026-10', at(10, 25));

    expect(limitOf(firstPaid).available).toBe(230000);

    const secondPaid = pay(nextCycle(firstPaid), '2026-11', at(11, 21));
    expect(limitOf(secondPaid).available).toBe(260000);
  });

  it('3. desfazer o pagamento volta a comprometer o limite', () => {
    const paid = pay(buy(base(), '2026-10-16', 300000, 10), '2026-10', at(10, 25));
    const undone = undoStatementPayment(paid, paid.statementPayments[0]!.id, at(10, 25));

    expect(limitOf(undone).available).toBe(200000);
  });

  it('4. a fatura que vence no ciclo já reduz o disponível antes do vencimento', () => {
    const state = buy(base(), '2026-10-16', 120000);

    expect(statementOf(state, '2026-10')).toMatchObject({ status: 'open', dueDate: '2026-10-27' });
    expect(initial(state)).toBe(400000 - 120000);
  });

  it('5. pagar a fatura reservada não desconta de novo', () => {
    const state = buy(base(), '2026-10-16', 120000);
    const paid = pay(state, '2026-10', at(10, 25));

    expect(initial(paid)).toBe(initial(state));
    expect(statementOf(paid, '2026-10', at(10, 25))).toMatchObject({
      status: 'paid',
      remaining: 0,
    });
  });

  it('6. nova compra na mesma fatura aumenta a fatura e reduz o disponível na hora', () => {
    const before = buy(base(), '2026-10-10', 80000);
    const after = buy(before, '2026-10-16', 20000);

    expect(statementOf(before, '2026-10').amount).toBe(80000);
    expect(statementOf(after, '2026-10').amount).toBe(100000);
    expect(initial(after)).toBe(initial(before) - 20000);
  });

  it('7. compra em fatura que vence no próximo ciclo não muda o ciclo atual', () => {
    const ctx = at(10, 22);
    const state = base(ctx);
    const bought = buy(state, '2026-10-22', 50000, 1, ctx);

    expect(initial(bought)).toBe(initial(state));
    expect(selectCycleProjections(bought, ctx.now, 1)[0]).toMatchObject({
      cycleKey: '2026-11',
      cardCharges: 50000,
    });
  });

  it('8. onboarding: a parcela atual já incluída no total da fatura não soma de novo', () => {
    const balance = addExistingCardDebt(
      base(),
      {
        cardId: 'card-1',
        description: 'Fatura atual',
        category: 'Outros',
        installmentAmount: 135000,
        totalInstallments: 1,
        remainingInstallments: 1,
        nextStatementKey: '2026-10',
        statementBalance: true,
      },
      TODAY,
    );
    const notebook = {
      cardId: 'card-1',
      description: 'Notebook',
      category: 'Educação',
      installmentAmount: 30000,
      totalInstallments: 10,
      remainingInstallments: 6,
      nextStatementKey: '2026-10',
    };
    const included = addExistingCardDebt(
      balance,
      { ...notebook, includedInStatementBalance: true },
      TODAY,
    );
    const notIncluded = addExistingCardDebt(balance, notebook, TODAY);

    expect(statementOf(included, '2026-10')).toMatchObject({ amount: 135000, knownTotal: 135000 });
    expect(
      statementOf(included, '2026-10').installments.find((item) => item.includedInBalance),
    ).toMatchObject({ number: 5, amount: 0, nominalAmount: 30000 });
    expect(initial(included)).toBe(400000 - 135000);
    // Limite: total informado + as 5 parcelas futuras do notebook.
    expect(limitOf(included).committed).toBe(135000 + 5 * 30000);
    expect(selectCycleProjections(included, TODAY.now, 1)[0]!.cardCharges).toBe(30000);
    // Sem marcar "já incluída", a parcela soma ao total (escolha explícita do usuário).
    expect(statementOf(notIncluded, '2026-10').amount).toBe(165000);
  });

  it('9. pagamento parcial: libera só o pago e o restante continua comprometido', () => {
    const state = buy(base(), '2026-10-16', 200000);
    const partial = pay(state, '2026-10', at(10, 25), 120000);

    expect(statementOf(partial, '2026-10', at(10, 25))).toMatchObject({
      amount: 200000,
      paid: 120000,
      remaining: 80000,
      status: 'partial',
    });
    expect(limitOf(partial)).toMatchObject({ committed: 80000, available: 420000 });
    expect(initial(partial)).toBe(initial(state));
    expect(selectUpcomingCommitments(partial, at(10, 25).now)).toEqual([
      expect.objectContaining({ kind: 'statement', amount: 80000 }),
    ]);
  });

  it('10. juros no pagamento: só o excedente pesa no orçamento', () => {
    const state = buy(base(), '2026-10-16', 100000);
    const paid = pay(state, '2026-10', at(10, 30), 108000);

    expect(paid.statementPayments[0]).toMatchObject({ paidAmount: 108000, charges: 8000 });
    expect(initial(paid)).toBe(initial(state) - 8000);
    expect(limitOf(paid).committed).toBe(0);
  });

  it('11. compra acima do limite fica registrada e o disponível fica negativo', () => {
    const state = buy(base(), '2026-10-16', 450000, 10);

    expect(calculateLimitExcess(limitOf(state).available, 70000)).toBe(20000);

    const over = buy(state, '2026-10-16', 70000);
    expect(over.cardPurchases).toHaveLength(2);
    expect(limitOf(over)).toMatchObject({ creditLimit: 500000, available: -20000 });
  });

  it('12. alterar o limite muda só a capacidade de crédito', () => {
    const state = buy(base(), '2026-10-16', 100000);
    const raised = saveCreditCard(
      state,
      { id: cardId(state), name: 'Nubank', closingDay: 20, dueDay: 27, creditLimit: 700000 },
      TODAY,
    );
    const daily = (doc: LocalState) => buildDashboardSummary(selectActiveMonth(doc)!, TODAY.now);

    expect(limitOf(raised).available).toBe(limitOf(state).available! + 200000);
    expect(selectConfig(raised)!.monthlyIncome).toBe(selectConfig(state)!.monthlyIncome);
    expect(initial(raised)).toBe(initial(state));
    expect(daily(raised).currentDailyLimit).toBe(daily(state).currentDailyLimit);
  });

  it('13. parcelas com centavos somam exatamente o total', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
  });
});

describe('restante de fatura parcial vira dívida do próximo ciclo (BR-FIN-034)', () => {
  it('volta ao resultado do ciclo encerrado e fica reservado no seguinte até ser quitado', () => {
    const state = pay(buy(base(), '2026-10-16', 200000), '2026-10', at(10, 25), 120000);
    const next = nextCycle(state);
    const [closed] = selectClosedMonths(next);

    // Outubro: 400.000 − 200.000 reservados, sem gastos; os 80.000 não pagos voltam ao resultado.
    expect(closed).toMatchObject({
      finalBalance: 280000,
      carriedStatements: [{ cardId: cardId(state), statementKey: '2026-10', amount: 80000 }],
    });
    expect(selectActiveCycle(next)).toMatchObject({
      carriedStatementDebt: 80000,
      initialAvailableAmount: 400000 - 80000,
    });

    // Quitar o restante no ciclo seguinte não desconta de novo e libera o limite.
    const settled = pay(next, '2026-10', at(11, 8), 80000);
    expect(initial(settled)).toBe(320000);
    expect(limitOf(settled).committed).toBe(0);
    expect(selectClosedMonths(nextCycle2(settled))[0]!.carriedStatements).toBeUndefined();
  });

  it('sem nenhum lançamento a fatura não é transportada; encargos informados depois pesam no ciclo', () => {
    const state = buy(base(), '2026-10-16', 200000);
    const next = nextCycle(state);

    expect(selectClosedMonths(next)[0]!.carriedStatements).toBeUndefined();
    expect(initial(next)).toBe(400000);

    const charged = addStatementCharges(
      next,
      { cardId: cardId(next), statementKey: '2026-10', amount: 5000 },
      at(11, 8),
    );
    expect(initial(charged)).toBe(395000);
    expect(statementOf(charged, '2026-10', at(11, 8))).toMatchObject({
      charges: 5000,
      remaining: 205000,
    });
  });

  it('restante não quitado é transportado de novo, sem passar do que o ciclo reservou', () => {
    const state = pay(buy(base(), '2026-10-16', 200000), '2026-10', at(10, 25), 120000);
    const november = pay(nextCycle(state), '2026-10', at(11, 8), 30000);
    const december = nextCycle2(november);

    expect(selectClosedMonths(december)[0]).toMatchObject({
      carriedStatements: [{ statementKey: '2026-10', amount: 50000 }],
    });
    expect(selectActiveCycle(december)).toMatchObject({ carriedStatementDebt: 50000 });
  });
});

describe('invariantes do domínio (BR-FIN-030)', () => {
  it('soma das parcelas = total da compra, para qualquer total e número de parcelas', () => {
    for (const total of [1, 99, 10000, 123457, 999999]) {
      for (const count of [1, 2, 3, 7, 12, 48]) {
        const parts = splitInstallments(total, count);
        expect(parts.reduce((sum, value) => sum + value, 0)).toBe(total);
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('cada parcela pesa uma única vez no orçamento, no ciclo do seu vencimento', () => {
    const state = buy(base(), '2026-10-16', 100000, 4);
    const projections = selectCycleProjections(state, TODAY.now, 6);
    const thisCycle = 400000 - initial(state);

    expect(thisCycle + projections.reduce((sum, item) => sum + item.cardCharges, 0)).toBe(100000);
    expect(listInstallments(state.cardPurchases[0]!).map((item) => item.cycleKey)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
  });

  it('excluir o total informado faz a parcela incluída voltar a contar (nada some)', () => {
    let state = addExistingCardDebt(
      base(),
      {
        cardId: 'card-1',
        description: 'Fatura atual',
        category: 'Outros',
        installmentAmount: 50000,
        totalInstallments: 1,
        remainingInstallments: 1,
        nextStatementKey: '2026-10',
        statementBalance: true,
      },
      TODAY,
    );
    state = addExistingCardDebt(
      state,
      {
        cardId: 'card-1',
        description: 'Celular',
        category: 'Pessoal',
        installmentAmount: 15000,
        totalInstallments: 12,
        remainingInstallments: 7,
        nextStatementKey: '2026-10',
        includedInStatementBalance: true,
      },
      TODAY,
    );
    const balanceId = state.cardPurchases.find((item) => item.kind === 'statement-balance')!.id;
    const withoutBalance = deleteCardPurchase(state, balanceId, TODAY);

    expect(statementOf(state, '2026-10').amount).toBe(50000);
    expect(statementOf(withoutBalance, '2026-10').amount).toBe(15000);
  });

  it('itens incluídos não podem passar do total informado', () => {
    const balance = addExistingCardDebt(
      base(),
      {
        cardId: 'card-1',
        description: 'Fatura atual',
        category: 'Outros',
        installmentAmount: 20000,
        totalInstallments: 1,
        remainingInstallments: 1,
        nextStatementKey: '2026-10',
        statementBalance: true,
      },
      TODAY,
    );
    const item = {
      cardId: 'card-1',
      description: 'Notebook',
      category: 'Educação',
      installmentAmount: 30000,
      totalInstallments: 10,
      remainingInstallments: 6,
      nextStatementKey: '2026-10',
      includedInStatementBalance: true,
    };

    expect(() => addExistingCardDebt(balance, item, TODAY)).toThrow('somam mais que o total');
    const fresh = base();
    expect(() => addExistingCardDebt(fresh, { ...item, cardId: cardId(fresh) }, TODAY)).toThrow(
      'Informe antes o total',
    );
    expect(() =>
      addExistingCardDebt(
        balance,
        {
          ...item,
          installmentAmount: 1,
          totalInstallments: 1,
          remainingInstallments: 1,
          includedInStatementBalance: false,
          statementBalance: true,
        },
        TODAY,
      ),
    ).toThrow('Já existe um total informado');
  });
});

/** Fecha o ciclo de novembro e abre o de dezembro (05/12). */
function nextCycle2(state: LocalState) {
  return openCycle(closeCycle(state, at(12, 5)), at(12, 5));
}

describe('regressões da revisão (ADR-018)', () => {
  it('M1: fatura que pesa em dois ciclos não é transportada além do que o ciclo reservou', () => {
    const first = buy(base(), '2026-10-16', 100000);
    const changed = saveCreditCard(
      first,
      { id: cardId(first), name: 'Nubank', closingDay: 20, dueDay: 10, creditLimit: 500000 },
      at(10, 17),
    );
    const second = buy(changed, '2026-10-18', 100000, 1, at(10, 18));
    const partial = pay(second, '2026-10', at(10, 25), 40000);

    // A compra B pesa em novembro pelo vencimento novo; outubro só transporta o seu restante.
    expect(statementOf(partial, '2026-10', at(10, 25)).remaining).toBe(160000);
    const next = nextCycle(partial);
    expect(selectClosedMonths(next)[0]!.carriedStatements).toEqual([
      expect.objectContaining({ amount: 60000 }),
    ]);
    expect(initial(next)).toBe(400000 - 60000 - 100000);
  });

  it('M2: recadastrar um total menor que as parcelas incluídas é recusado', () => {
    const balanceInput = {
      cardId: 'card-1',
      description: 'Fatura atual',
      category: 'Outros',
      installmentAmount: 100000,
      totalInstallments: 1,
      remainingInstallments: 1,
      nextStatementKey: '2026-10',
      statementBalance: true,
    };
    let state = addExistingCardDebt(base(), balanceInput, TODAY);
    state = addExistingCardDebt(
      state,
      {
        cardId: 'card-1',
        description: 'TV',
        category: 'Casa',
        installmentAmount: 80000,
        totalInstallments: 3,
        remainingInstallments: 3,
        nextStatementKey: '2026-10',
        includedInStatementBalance: true,
      },
      TODAY,
    );
    const balanceId = state.cardPurchases.find((item) => item.kind === 'statement-balance')!.id;
    const withoutBalance = deleteCardPurchase(state, balanceId, TODAY);

    expect(() =>
      addExistingCardDebt(withoutBalance, { ...balanceInput, installmentAmount: 30000 }, TODAY),
    ).toThrow('somam mais que o total');
  });

  it('B4: fatura só com encargos registrados não é transportada', () => {
    const state = buy(base(), '2026-10-16', 100000);
    const charged = addStatementCharges(
      state,
      { cardId: cardId(state), statementKey: '2026-10', amount: 3000 },
      at(10, 30),
    );

    expect(selectClosedMonths(nextCycle(charged))[0]!.carriedStatements).toBeUndefined();
  });
});
