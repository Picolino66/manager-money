import { format } from 'date-fns';

import {
  buildCardStatements,
  calculateCardLimitUsage,
  calculateFirstCycleKey,
  calculateInstallmentForCycle,
  CardPurchase,
  CreditCard,
  currentStatementKey,
  listInstallments,
  splitInstallments,
  statementCycleKey,
  statementDueDate,
  statementKeyForDate,
  StatementPayment,
  summarizeStatement,
} from './credit-card';

const card: CreditCard = {
  id: 'k1',
  name: 'Nubank',
  closingDay: 20,
  dueDay: 27,
  creditLimit: 500000,
  active: true,
};
const lateDue: CreditCard = { ...card, id: 'k2', closingDay: 28, dueDay: 5 };

const purchase = (overrides: Partial<CardPurchase>): CardPurchase => ({
  id: 'p1',
  cardId: 'k1',
  description: 'Compra',
  category: 'Outros',
  totalAmount: 60000,
  installments: 1,
  purchaseDate: '2026-10-15',
  firstStatementKey: '2026-10',
  firstCycleKey: '2026-10',
  settledInstallments: 0,
  createdAt: '2026-10-15T12:00:00.000Z',
  ...overrides,
});

const ymd = (date: Date) => format(date, 'yyyy-MM-dd');

describe('fatura da compra (BR-FIN-025)', () => {
  it('antes do fechamento entra na fatura aberta; no dia do fechamento também; depois, na próxima', () => {
    expect(statementKeyForDate(new Date(2026, 9, 15), 20)).toBe('2026-10');
    expect(statementKeyForDate(new Date(2026, 9, 20), 20)).toBe('2026-10');
    expect(statementKeyForDate(new Date(2026, 9, 22), 20)).toBe('2026-11');
  });

  it('dezembro depois do fechamento vira janeiro do ano seguinte', () => {
    expect(statementKeyForDate(new Date(2026, 11, 29), 28)).toBe('2027-01');
  });

  it('vencimento no mesmo mês quando vem depois do fechamento; senão no mês seguinte', () => {
    expect(ymd(statementDueDate('2026-10', card))).toBe('2026-10-27');
    expect(ymd(statementDueDate('2026-10', lateDue))).toBe('2026-11-05');
    expect(ymd(statementDueDate('2026-12', lateDue))).toBe('2027-01-05');
    // Fevereiro: dias limitados a 28 nunca caem fora do mês.
    expect(ymd(statementDueDate('2027-02', { closingDay: 28, dueDay: 28 }))).toBe('2027-03-28');
  });

  it('a fatura pertence ao ciclo do vencimento, não ao da compra', () => {
    // Recebe dia 5: vencimento 27/10 → ciclo de outubro; vencimento 05/11 → ciclo de novembro.
    expect(statementCycleKey('2026-10', card, 5)).toBe('2026-10');
    expect(statementCycleKey('2026-10', lateDue, 5)).toBe('2026-11');
    // Recebe dia 10: vencimento 05/11 ainda está no ciclo de outubro.
    expect(statementCycleKey('2026-10', lateDue, 10)).toBe('2026-10');
  });

  it('nunca antes do ciclo ativo (ciclo antecipado)', () => {
    expect(
      calculateFirstCycleKey(new Date(2026, 10, 2), { closingDay: 1, dueDay: 3 }, 5, '2026-11'),
    ).toBe('2026-11');
  });

  it('fatura aberta hoje', () => {
    expect(currentStatementKey(card, new Date(2026, 9, 20, 23))).toBe('2026-10');
    expect(currentStatementKey(card, new Date(2026, 9, 21, 0))).toBe('2026-11');
  });
});

describe('parcelas (BR-FIN-020/027)', () => {
  it('parcelamento de 24x atravessa anos com fatura e ciclo em sequência', () => {
    const installments = listInstallments(
      purchase({
        totalAmount: 240000,
        installments: 24,
        firstStatementKey: '2026-11',
        firstCycleKey: '2026-11',
      }),
    );

    expect(installments).toHaveLength(24);
    expect(installments[2]).toMatchObject({
      number: 3,
      statementKey: '2027-01',
      cycleKey: '2027-01',
    });
    expect(installments[23]).toMatchObject({
      number: 24,
      statementKey: '2028-10',
      cycleKey: '2028-10',
    });
  });

  it('arredondamento: centavos que sobram vão para as primeiras e o total é preservado', () => {
    const parts = splitInstallments(100000, 3);

    expect(parts).toEqual([33334, 33333, 33333]);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(100000);
  });

  it('parcelas quitadas antes do cadastro não pesam no ciclo', () => {
    const imported = purchase({
      totalAmount: 300000,
      installments: 10,
      firstStatementKey: '2026-06',
      firstCycleKey: '2026-06',
      settledInstallments: 4,
    });

    expect(calculateInstallmentForCycle(imported, '2026-09')).toBeNull();
    expect(calculateInstallmentForCycle(imported, '2026-10')).toMatchObject({
      number: 5,
      amount: 30000,
    });
    expect(calculateInstallmentForCycle(imported, '2027-03')).toMatchObject({ number: 10 });
    expect(calculateInstallmentForCycle(imported, '2027-04')).toBeNull();
  });
});

describe('faturas e limite (BR-FIN-026)', () => {
  const purchases = [
    purchase({ id: 'a', totalAmount: 60000, installments: 3 }),
    purchase({
      id: 'b',
      totalAmount: 10000,
      firstStatementKey: '2026-11',
      firstCycleKey: '2026-11',
    }),
    purchase({ id: 'other', cardId: 'k2', totalAmount: 99999 }),
  ];
  const payment: StatementPayment = {
    id: 's1',
    cardId: 'k1',
    statementKey: '2026-10',
    cycleId: 'c1',
    statementAmount: 20000,
    paidAmount: 20000,
    charges: 0,
    paidAt: '2026-10-25',
  };

  it('agrupa parcelas por fatura com status por data', () => {
    const statements = buildCardStatements(card, purchases, [], new Date(2026, 9, 28));

    expect(statements.map((item) => [item.key, item.amount, item.status])).toEqual([
      ['2026-10', 20000, 'overdue'],
      ['2026-11', 30000, 'open'],
      ['2026-12', 20000, 'open'],
    ]);
    expect(buildCardStatements(card, purchases, [], new Date(2026, 9, 21))[0]!.status).toBe(
      'closed',
    );
    expect(buildCardStatements(card, purchases, [payment], new Date(2026, 9, 28))[0]).toMatchObject(
      { status: 'paid', payments: [payment], paid: 20000, remaining: 0 },
    );
  });

  it('limite comprometido = parcelas em faturas não pagas, inclusive futuras', () => {
    expect(calculateCardLimitUsage(card, purchases, [])).toEqual({
      creditLimit: 500000,
      committed: 70000,
      available: 430000,
    });
    expect(calculateCardLimitUsage(card, purchases, [payment])).toEqual({
      creditLimit: 500000,
      committed: 50000,
      available: 450000,
    });
    expect(calculateCardLimitUsage({ ...card, creditLimit: null }, purchases, [])).toMatchObject({
      available: null,
    });
  });

  it('resumo da fatura: encargos aumentam o devido; o pagamento amortiza primeiro o principal', () => {
    expect(summarizeStatement(100000, [{ paidAmount: 108000, charges: 8000 }])).toEqual({
      charges: 8000,
      paid: 108000,
      remaining: 0,
      amortized: 100000,
    });
    expect(summarizeStatement(200000, [{ paidAmount: 120000, charges: 0 }])).toEqual({
      charges: 0,
      paid: 120000,
      remaining: 80000,
      amortized: 120000,
    });
  });
});
