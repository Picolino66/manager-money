import { ExpenseCategory, MoneyCents } from './financial.types';

/** Forma de pagamento de uma despesa fixa (BR-FIN-021). */
export type PaymentMethod = 'pix' | 'cash' | 'debit' | 'credit';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['pix', 'cash', 'debit', 'credit'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  debit: 'Débito',
  credit: 'Crédito',
};

/**
 * Pagamento de uma despesa fixa em um ciclo. Guarda uma foto do nome e da categoria para o
 * histórico sobreviver à edição da despesa. No crédito, `cardPurchaseId` aponta para a compra
 * criada com `amount + interest`.
 */
export type FixedExpensePayment = {
  id: string;
  cycleId: string;
  fixedExpenseId: string;
  name: string;
  category: ExpenseCategory;
  method: PaymentMethod;
  /** Valor da despesa fixa, sem juros. */
  amount: MoneyCents;
  /** Juros cobrados no crédito (0 nas demais formas). */
  interest: MoneyCents;
  /** Data do pagamento (yyyy-MM-dd), limitada ao período do ciclo. */
  paidAt: string;
  cardPurchaseId?: string;
};

/** Renda avulsa lançada em um ciclo (BR-FIN-023). */
export type ExtraIncome = {
  id: string;
  cycleId: string;
  name: string;
  amount: MoneyCents;
  /** Data do recebimento (yyyy-MM-dd), dentro do ciclo. */
  date: string;
};

/** Valor que sai da renda do ciclo agora: no crédito, quem desconta é a fatura (BR-FIN-019). */
export function calculatePaidFixedAmount(payments: Pick<FixedExpensePayment, 'method' | 'amount'>[]): MoneyCents {
  return payments.reduce(
    (total, payment) => (payment.method === 'credit' ? total : total + payment.amount),
    0,
  );
}

export function calculateExtraIncomeTotal(incomes: Pick<ExtraIncome, 'amount'>[]): MoneyCents {
  return incomes.reduce((total, income) => total + income.amount, 0);
}
