import { calculateCardLimitUsage } from '../domain/financial/credit-card';
import { MoneyCents } from '../domain/financial/financial.types';
import { selectActiveCreditCards, selectStatementPayments } from './selectors';
import { isLive, LocalState } from './state';

export type CreditDailyPoint = {
  /** yyyy-MM-dd. */
  date: string;
  /** Compras no cartão feitas no dia, pelo valor total (é o que compromete o limite). */
  creditSpent: MoneyCents;
  /**
   * Limite disponível dos cartões ativos com limite informado ao fim do dia (limite − comprometido
   * por compras e pagamentos de fatura até a data); `null` se nenhum cartão tem limite.
   */
  creditAvailable: MoneyCents | null;
};

/**
 * BR-FIN-037: série diária do crédito para os gráficos da visão geral (web). Reconstrói o limite
 * "como estava" em cada dia: só conta compra datada até o dia (compras anteriores ao app contam
 * sempre) e pagamento de fatura lançado até o dia. Compra gerada por fixa paga no crédito é gasto no
 * cartão como qualquer outra.
 */
export function selectCreditDailySeries(state: LocalState, dates: string[]): CreditDailyPoint[] {
  const cards = selectActiveCreditCards(state);
  const cardIds = new Set(cards.map((card) => card.id));
  const purchases = state.cardPurchases.filter((purchase) => isLive(purchase));
  const payments = selectStatementPayments(state);

  return dates.map((date) => {
    const creditSpent = purchases
      .filter(
        (purchase) =>
          cardIds.has(purchase.cardId) &&
          purchase.origin !== 'existing' &&
          purchase.purchaseDate === date,
      )
      .reduce((total, purchase) => total + purchase.totalAmount, 0);

    const known = purchases.filter(
      (purchase) => purchase.origin === 'existing' || purchase.purchaseDate <= date,
    );
    const paid = payments.filter((payment) => payment.paidAt <= date);
    let available: MoneyCents | null = null;

    for (const card of cards) {
      const usage = calculateCardLimitUsage(
        card,
        known.filter((purchase) => purchase.cardId === card.id),
        paid.filter((payment) => payment.cardId === card.id),
      );

      if (usage.available !== null) {
        available = (available ?? 0) + usage.available;
      }
    }

    return { date, creditSpent, creditAvailable: available };
  });
}
