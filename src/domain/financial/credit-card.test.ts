import {
  addCycleKeys,
  calculateCardChargesForCycle,
  calculateFirstCycleKey,
  calculateInstallmentForCycle,
  calculateInvoiceClosingDate,
  CardPurchase,
  cycleKeyFromDate,
  cycleKeyFromStartDate,
  lastInstallmentCycleKey,
  splitInstallments,
} from './credit-card';

const purchase: CardPurchase = {
  id: 'p1',
  cardId: 'k1',
  description: 'Notebook',
  category: 'Educação',
  totalAmount: 10000,
  installments: 3,
  purchaseDate: '2026-10-20',
  firstCycleKey: '2026-11',
  createdAt: '2026-10-20T12:00:00.000Z',
};

describe('splitInstallments (BR-FIN-020)', () => {
  it('distribui os centavos que sobram nas primeiras parcelas e preserva o total', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitInstallments(10001, 4)).toEqual([2501, 2500, 2500, 2500]);
    expect(splitInstallments(999, 1)).toEqual([999]);
    expect(splitInstallments(12345, 7).reduce((a, b) => a + b, 0)).toBe(12345);
  });
});

describe('chaves de ciclo', () => {
  it('derivam do início do ciclo e do dia de pagamento', () => {
    expect(cycleKeyFromStartDate('2026-10-07')).toBe('2026-10');
    expect(cycleKeyFromDate(new Date(2026, 9, 7), 7)).toBe('2026-10');
    expect(cycleKeyFromDate(new Date(2026, 9, 6), 7)).toBe('2026-09');
    expect(cycleKeyFromDate(new Date(2027, 0, 3), 7)).toBe('2026-12');
    expect(cycleKeyFromDate(new Date(2026, 9, 15), 1)).toBe('2026-10');
  });

  it('somam meses atravessando o ano', () => {
    expect(addCycleKeys('2026-11', 1)).toBe('2026-12');
    expect(addCycleKeys('2026-11', 2)).toBe('2027-01');
    expect(addCycleKeys('2026-01', -1)).toBe('2025-12');
  });
});

describe('fechamento da fatura (BR-FIN-019)', () => {
  it('até o dia de fechamento fecha no mês; depois, no seguinte', () => {
    expect(calculateInvoiceClosingDate(new Date(2026, 9, 20), 25)).toEqual(new Date(2026, 9, 25));
    expect(calculateInvoiceClosingDate(new Date(2026, 9, 25), 25)).toEqual(new Date(2026, 9, 25));
    expect(calculateInvoiceClosingDate(new Date(2026, 9, 28), 25)).toEqual(new Date(2026, 10, 25));
    expect(calculateInvoiceClosingDate(new Date(2026, 11, 28), 25)).toEqual(new Date(2027, 0, 25));
  });

  it('a compra cai no ciclo que contém o fechamento, nunca antes do ciclo ativo', () => {
    // Fecha 25, pagamento dia 7: antes do fechamento = ciclo atual; depois = próximo.
    expect(calculateFirstCycleKey(new Date(2026, 9, 20), 25, 7, '2026-10')).toBe('2026-10');
    expect(calculateFirstCycleKey(new Date(2026, 9, 28), 25, 7, '2026-10')).toBe('2026-11');
    // Dia 2/11 ainda está no ciclo de outubro, mas o fechamento (25/11) cai no ciclo de novembro.
    expect(calculateFirstCycleKey(new Date(2026, 10, 2), 25, 7, '2026-10')).toBe('2026-11');
    // Fecha dia 3: o fechamento (3/11) está no ciclo de outubro.
    expect(calculateFirstCycleKey(new Date(2026, 9, 20), 3, 7, '2026-10')).toBe('2026-10');
    // Fechamento antes do início do ciclo ativo (ciclo antecipado) é limitado ao ciclo ativo.
    expect(calculateFirstCycleKey(new Date(2026, 10, 4), 5, 7, '2026-11')).toBe('2026-11');
  });
});

describe('parcelas por ciclo', () => {
  it('devolve a parcela certa em cada ciclo e nada fora do intervalo', () => {
    expect(calculateInstallmentForCycle(purchase, '2026-10')).toBeNull();
    expect(calculateInstallmentForCycle(purchase, '2026-11')).toMatchObject({ number: 1, amount: 3334 });
    expect(calculateInstallmentForCycle(purchase, '2027-01')).toMatchObject({ number: 3, amount: 3333 });
    expect(calculateInstallmentForCycle(purchase, '2027-02')).toBeNull();
  });

  it('soma as cobranças do ciclo e informa o último ciclo', () => {
    const other: CardPurchase = { ...purchase, id: 'p2', totalAmount: 600, installments: 1, firstCycleKey: '2026-12' };
    expect(calculateCardChargesForCycle([purchase, other], '2026-12')).toBe(3333 + 600);
    expect(calculateCardChargesForCycle([purchase, other], '2026-10')).toBe(0);
    expect(lastInstallmentCycleKey(purchase)).toBe('2027-01');
  });
});
