import { calculatePaidFixedAmount } from '../domain/financial/payments';
import { calculateRemainingAvailableAmount } from '../domain/financial/financial.calculations';
import { MoneyCents } from '../domain/financial/financial.types';
import {
  selectActiveMonth,
  selectConfig,
  selectCyclePayments,
  selectUpcomingCommitments,
} from './selectors';
import { LocalState } from './state';

export type CycleBalance = {
  /** Saldo em conta pela conta do app: disponível + reservados + meta. */
  balance: MoneyCents;
  /** Compromissos reservados ainda não pagos (fixas pendentes e faturas a pagar). */
  reserved: MoneyCents;
  savingGoal: MoneyCents;
  /** Fixas do ciclo pagas pelo saldo (já estavam reservadas). */
  fixedPaid: MoneyCents;
};

/**
 * BR-FIN-041: saldo em conta do ciclo ativo, sem descontar o que está reservado nem a meta —
 * "Disponível no ciclo" + compromissos reservados (os mesmos da lista da visão geral) + meta. Pagar
 * uma fixa ou fatura pelo saldo tira do reservado e baixa o saldo; o disponível não muda. Nulo sem
 * configuração ou sem ciclo ativo.
 */
export function selectCycleBalance(state: LocalState, today: Date): CycleBalance | null {
  const config = selectConfig(state);
  const month = selectActiveMonth(state);

  if (!config || !month) return null;

  const reserved = selectUpcomingCommitments(state, today).reduce(
    (total, item) => total + item.amount,
    0,
  );

  return {
    balance: calculateRemainingAvailableAmount(month) + reserved + config.savingGoal,
    reserved,
    savingGoal: config.savingGoal,
    fixedPaid: calculatePaidFixedAmount(selectCyclePayments(state, month.id)),
  };
}
