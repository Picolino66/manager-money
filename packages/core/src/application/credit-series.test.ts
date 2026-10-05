import { addCardPurchase, addExistingCardDebt, saveCreditCard } from './card.use-cases';
import {
  listSeriesDates,
  selectBalanceDailySeries,
  selectCreditDailySeries,
  selectCreditPeriod,
  statementKeysDueBetween,
} from './credit-series';
import { addExpense } from './cycle.use-cases';
import { selectCreditSnapshot } from './selectors';
import { openCycle, saveConfig } from './cycle.use-cases';
import { createEmptyState, LocalState, UseCaseContext } from './state';

let sequence = 0;
const TODAY: UseCaseContext = {
  now: new Date(2026, 9, 16, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
};

/** Hoje = 16/10/2026, ciclo 05/10–04/11; cartão fecha dia 20 e vence dia 27. */
function base(limit: number | null = 500000): LocalState {
  const configured = saveConfig(
    createEmptyState(),
    {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 5 }],
      savingGoal: 0,
      customCategories: [],
      fixedExpenses: [],
    },
    TODAY,
  );

  return openCycle(
    saveCreditCard(
      configured,
      { name: 'Nubank', closingDay: 20, dueDay: 27, creditLimit: limit ?? undefined },
      TODAY,
    ),
    TODAY,
  );
}

const buy = (state: LocalState, date: string, totalAmount: number, installments = 1) =>
  addCardPurchase(
    state,
    {
      cardId: state.creditCards[0]!.id,
      description: 'Compra',
      category: 'Pessoal',
      totalAmount,
      installments,
      date,
    },
    TODAY,
  );

const DAYS = ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'];

describe('selectCreditDailySeries (BR-FIN-037/039)', () => {
  it('período livre: gasto do dia pela parcela da fatura e limite "como estava" em cada dia', () => {
    let state = buy(base(), '2026-10-10', 30000);

    state = buy(state, '2026-10-12', 9000, 3);

    const series = selectCreditDailySeries(state, DAYS);

    expect(series.map((point) => point.creditSpent)).toEqual([0, 30000, 0, 3000, 0]);
    // A fatura de out/2026 (fecha dia 20) acumula as compras do período até o dia.
    expect(series.map((point) => point.statementTotal)).toEqual([0, 30000, 30000, 33000, 33000]);
    expect(series.map((point) => point.creditAvailable)).toEqual([
      500000, 470000, 470000, 461000, 461000,
    ]);
  });

  it('compra anterior ao app já pesa desde o 1º dia e não conta como gasto do dia', () => {
    const configured = base();
    const state = addExistingCardDebt(
      configured,
      {
        cardId: configured.creditCards[0]!.id,
        description: 'Geladeira',
        category: 'Casa',
        installmentAmount: 10000,
        totalInstallments: 10,
        remainingInstallments: 6,
        nextStatementKey: '2026-10',
      },
      TODAY,
    );
    const series = selectCreditDailySeries(state, DAYS);

    expect(series.every((point) => point.creditSpent === 0)).toBe(true);
    // A parcela da fatura de out/2026 já estava nela antes do período.
    expect(series.every((point) => point.statementTotal === 10000)).toBe(true);
    // Sem data salva, vale a data padrão (antes do período): as 6 parcelas restantes de R$ 100,00 já ocupam R$ 600,00.
    expect(series.every((point) => point.creditAvailable === 500000 - 60000)).toBe(true);
  });

  it('cartão sem limite: disponível nulo, mas o gasto aparece', () => {
    const state = buy(base(null), '2026-10-10', 12000);
    const series = selectCreditDailySeries(state, DAYS);

    expect(series.map((point) => point.creditAvailable)).toEqual([null, null, null, null, null]);
    expect(series[1]!.creditSpent).toBe(12000);
  });

  it('sem cartões: tudo zerado e sem limite', () => {
    const state = openCycle(
      saveConfig(
        createEmptyState(),
        {
          incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 5 }],
          savingGoal: 0,
          customCategories: [],
          fixedExpenses: [],
        },
        TODAY,
      ),
      TODAY,
    );

    expect(selectCreditDailySeries(state, DAYS.slice(0, 2))).toEqual([
      { date: '2026-10-09', creditSpent: 0, statementTotal: 0, creditAvailable: null },
      { date: '2026-10-10', creditSpent: 0, statementTotal: 0, creditAvailable: null },
    ]);
  });
});

/** Ciclo 05/10–04/11; cartão fecha dia 8 e vence dia 15 (a fatura de out/2026 vai de 09/09 a 08/10). */
function closingEight(): LocalState {
  const configured = saveConfig(
    createEmptyState(),
    {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 5 }],
      savingGoal: 0,
      customCategories: [],
      fixedExpenses: [],
    },
    TODAY,
  );
  let state = openCycle(
    saveCreditCard(
      configured,
      { name: 'Inter', closingDay: 8, dueDay: 15, creditLimit: 500000 },
      TODAY,
    ),
    TODAY,
  );
  const cardId = state.creditCards[0]!.id;

  state = addExistingCardDebt(
    state,
    {
      cardId,
      description: 'Sofá',
      category: 'Casa',
      installmentAmount: 10000,
      totalInstallments: 5,
      remainingInstallments: 3,
      nextStatementKey: '2026-10',
    },
    // Cadastrada em 06/10, antes do vencimento da fatura de out/2026 (15/10).
    { ...TODAY, now: new Date(2026, 9, 6, 12) },
  );
  state = buy(state, '2026-10-06', 9000, 3);

  return buy(state, '2026-10-10', 20000);
}

describe('período do cartão (BR-FIN-039)', () => {
  it('faturas que vencem no ciclo: período da abertura ao fechamento do cartão', () => {
    const period = selectCreditPeriod(closingEight(), 'due-in-cycle', TODAY.now);

    expect(period).toMatchObject({ from: '2026-09-09', to: '2026-10-08' });
    expect(period!.statements).toEqual([
      expect.objectContaining({
        key: '2026-10',
        openDate: '2026-09-09',
        closingDate: '2026-10-08',
        dueDate: '2026-10-15',
      }),
    ]);
  });

  it('fatura aberta: a que recebe as compras de hoje', () => {
    const period = selectCreditPeriod(closingEight(), 'open', TODAY.now);

    expect(period).toMatchObject({ from: '2026-10-09', to: '2026-11-08' });
    expect(period!.statements.map((item) => item.key)).toEqual(['2026-11']);
  });

  it('sem cartão (ou cartão filtrado inexistente) não há período', () => {
    expect(selectCreditPeriod(closingEight(), 'open', TODAY.now, 'outro')).toBeNull();
  });

  it('o último dia da fatura que vence no ciclo bate com o card "Gasto no crédito"', () => {
    const state = closingEight();
    const period = selectCreditPeriod(state, 'due-in-cycle', TODAY.now)!;
    const series = selectCreditDailySeries(state, listSeriesDates(period.from, period.to), {
      statements: period.statements,
      today: '2026-10-16',
    });

    // Parcela do sofá (já estava na fatura) desde o 1º dia; a 1ª parcela da compra de 06/10 entra no dia.
    expect(series[0]).toMatchObject({ date: '2026-09-09', statementTotal: 10000, creditSpent: 0 });
    expect(series.find((point) => point.date === '2026-10-06')).toMatchObject({
      creditSpent: 3000,
      statementTotal: 13000,
    });
    // A compra de 10/10 é da fatura seguinte: não entra.
    expect(series.at(-1)!.statementTotal).toBe(
      selectCreditSnapshot(state, TODAY.now).cycleStatementsAmount,
    );
    expect(series.at(-1)!.statementTotal).toBe(13000);
  });

  it('fatura aberta acumula as parcelas que já caíam nela; dias depois de hoje ficam vazios', () => {
    const state = closingEight();
    const period = selectCreditPeriod(state, 'open', TODAY.now)!;
    const series = selectCreditDailySeries(state, listSeriesDates(period.from, period.to), {
      statements: period.statements,
      today: '2026-10-16',
    });

    expect(series[0]).toMatchObject({ date: '2026-10-09', statementTotal: 13000, creditSpent: 0 });
    expect(series[1]).toMatchObject({
      date: '2026-10-10',
      statementTotal: 33000,
      creditSpent: 20000,
    });
    expect(series.find((point) => point.date === '2026-10-17')).toEqual({
      date: '2026-10-17',
      creditSpent: null,
      statementTotal: null,
      creditAvailable: null,
    });
  });

  it('compra anterior ao app com data no período entra no dia salvo (BR-FIN-036)', () => {
    const early = { ...TODAY, now: new Date(2026, 9, 6, 12) };
    let state = closingEight();
    const cardId = state.creditCards[0]!.id;

    // Fatura em aberto informada (total do banco), datada em 20/09, e parcelamento de 25/09.
    state = addExistingCardDebt(
      state,
      {
        cardId,
        description: 'Fatura atual',
        category: 'Outros',
        installmentAmount: 40000,
        totalInstallments: 1,
        remainingInstallments: 1,
        nextStatementKey: '2026-10',
        statementBalance: true,
        purchaseDate: '2026-09-20',
      },
      early,
    );
    state = addExistingCardDebt(
      state,
      {
        cardId,
        description: 'Fone',
        category: 'Lazer',
        installmentAmount: 5000,
        totalInstallments: 2,
        remainingInstallments: 2,
        nextStatementKey: '2026-10',
        purchaseDate: '2026-09-25',
      },
      early,
    );
    const period = selectCreditPeriod(state, 'due-in-cycle', TODAY.now)!;
    const series = selectCreditDailySeries(state, listSeriesDates(period.from, period.to), {
      statements: period.statements,
      today: '2026-10-16',
    });
    const on = (date: string) => series.find((point) => point.date === date)!;

    // Só o sofá (data antes do período) já está na fatura no 1º dia.
    expect(series[0]).toMatchObject({ statementTotal: 10000, creditSpent: 0 });
    expect(on('2026-09-20')).toMatchObject({ creditSpent: 40000, statementTotal: 50000 });
    expect(on('2026-09-25')).toMatchObject({ creditSpent: 5000, statementTotal: 55000 });
    // O último dia continua igual ao card "Gasto no crédito".
    expect(series.at(-1)!.statementTotal).toBe(
      selectCreditSnapshot(state, TODAY.now).cycleStatementsAmount,
    );
    // O disponível espelha a fatura: cai no dia de cada compra anterior ao app.
    expect(on('2026-09-19').creditAvailable! - on('2026-09-20').creditAvailable!).toBe(40000);
    expect(on('2026-09-24').creditAvailable! - on('2026-09-25').creditAvailable!).toBe(10000);
    // Hoje, o disponível é o mesmo do card "Disponível no crédito".
    const daily = selectCreditDailySeries(state, ['2026-10-16'], { today: '2026-10-16' });
    expect(daily[0]!.creditAvailable).toBe(selectCreditSnapshot(state, TODAY.now).availableLimit);
  });

  it('faturas que vencem entre duas datas', () => {
    expect(
      statementKeysDueBetween({ closingDay: 8, dueDay: 15 }, '2026-10-05', '2026-11-04'),
    ).toEqual(['2026-10']);
    expect(
      statementKeysDueBetween({ closingDay: 25, dueDay: 3 }, '2026-10-05', '2026-11-04'),
    ).toEqual(['2026-10']);
    expect(
      statementKeysDueBetween({ closingDay: 8, dueDay: 15 }, '2026-11-05', '2026-10-04'),
    ).toEqual([]);
  });

  it('lista de dias: vazia quando invertida ou longa demais', () => {
    expect(listSeriesDates('2026-10-01', '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(listSeriesDates('2026-10-03', '2026-10-01')).toEqual([]);
    expect(listSeriesDates('2020-01-01', '2026-10-01')).toEqual([]);
  });
});

describe('selectBalanceDailySeries (BR-FIN-039)', () => {
  it('cada dia usa o ciclo que o contém; fora de ciclo ou depois de hoje fica vazio', () => {
    const state = addExpense(
      base(),
      { description: 'Mercado', category: 'Mercado', amount: 5000, date: '2026-10-06' },
      TODAY,
    );
    const series = selectBalanceDailySeries(
      state,
      ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-17'],
      '2026-10-16',
    );

    expect(series[0]).toMatchObject({ cycleId: null, spent: null, limit: null, available: null });
    expect(series[1]).toMatchObject({ spent: 0, available: 500000 });
    expect(series[2]).toMatchObject({ spent: 5000, available: 495000 });
    expect(series[2]!.limit).toBeGreaterThan(0);
    expect(series[3]).toMatchObject({ spent: null, limit: null, available: null });
    expect(series[3]!.cycleId).not.toBeNull();
  });

  it('ciclo no negativo: o limite previsto para em zero; o disponível mostra o buraco (BR-FIN-040)', () => {
    const state = addExpense(
      base(),
      { description: 'Conserto', category: 'Casa', amount: 600000, date: '2026-10-06' },
      TODAY,
    );
    const [point] = selectBalanceDailySeries(state, ['2026-10-07'], '2026-10-16');

    expect(point).toMatchObject({ limit: 0, available: -100000 });
  });
});
