import { formatAxisReais, moneyTicks, moneyTicksBetween } from './chart';

describe('eixos monetários', () => {
  it('marcas redondas em reais inteiros cobrindo o máximo', () => {
    expect(moneyTicks(3000)).toEqual([0, 1000, 2000, 3000]);
    expect(moneyTicks(15778)).toEqual([0, 5000, 10000, 15000, 20000]);
    expect(moneyTicks(0)).toEqual([0, 100]);
    expect(moneyTicks(1_500_000)).toEqual([0, 500000, 1000000, 1500000]);
  });

  it('marcas com negativos incluem o mínimo e o zero', () => {
    expect(moneyTicksBetween(0, 3000)).toEqual(moneyTicks(3000));
    const ticks = moneyTicksBetween(-12000, 30000);

    expect(ticks[0]).toBeLessThanOrEqual(-12000);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(30000);
    expect(ticks).toContain(0);
    expect(moneyTicksBetween(-500, -100).at(-1)).toBeGreaterThanOrEqual(0);
  });

  it('rótulo sem centavos', () => {
    expect(formatAxisReais(150000)).toMatch(/^R\$\s1\.500$/);
  });
});
