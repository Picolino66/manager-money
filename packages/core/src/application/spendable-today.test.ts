import { describeCycleDeficit, describeSpendableToday } from './spendable-today';

describe('describeSpendableToday (BR-FIN-040)', () => {
  it('ciclo no negativo: mostra zero e o déficit do ciclo', () => {
    expect(
      describeSpendableToday({
        currentDailyLimit: -6547,
        todayBalance: -6547,
        remainingAvailableAmount: -130943,
      }),
    ).toEqual({ amount: 0, cycleDeficit: 130943 });
  });

  it('ciclo positivo: o saldo do dia de sempre, mesmo que hoje tenha passado do limite', () => {
    expect(
      describeSpendableToday({
        currentDailyLimit: 5000,
        todayBalance: -1000,
        remainingAvailableAmount: 40000,
      }),
    ).toEqual({ amount: -1000, cycleDeficit: null });
  });

  it('texto do déficit com o fim do ciclo', () => {
    // O formato de moeda usa espaço não separável depois do "R$".
    expect(describeCycleDeficit(130943, '2026-10-24').replace(/\s/g, ' ')).toBe(
      'Ciclo no negativo: faltam R$ 1.309,43 para cobrir até 24/10.',
    );
  });
});
