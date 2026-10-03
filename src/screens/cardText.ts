/** Texto de em qual ciclo cai a 1ª parcela de uma compra no crédito (BR-FIN-019). */
export function describeFirstInstallment(cyclesAhead: number): string {
  if (cyclesAhead <= 0) return 'a 1ª parcela entra neste ciclo';
  if (cyclesAhead === 1) return 'a 1ª parcela entra no próximo ciclo';

  return `a 1ª parcela entra daqui a ${cyclesAhead} ciclos`;
}
