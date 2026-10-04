import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FixedPaymentRecord } from '../application/state';
import { colors, radius, spacing, typography } from '../design/theme';
import { calculateFixedExpenseAmount } from '../domain/financial/financial.calculations';
import { FixedExpense, isActive } from '../domain/financial/financial.types';
import { PAYMENT_METHOD_LABELS } from '../domain/financial/payments';
import { formatCurrency } from '../utils/currency';
import { AppButton } from './AppButton';
import { Card } from './Card';

type FixedExpensesCardProps = {
  expenses: FixedExpense[];
  /** Pagamentos vigentes do ciclo ativo. */
  payments: FixedPaymentRecord[];
  /** Parcelas da compra no cartão por id, para descrever pagamentos no crédito. */
  installmentsByPurchaseId: Record<string, number>;
  onPay: (expense: FixedExpense) => void;
  onUndo: (payment: FixedPaymentRecord) => void;
};

function describePayment(payment: FixedPaymentRecord, installments?: number): string {
  const method = PAYMENT_METHOD_LABELS[payment.method];

  return payment.method === 'credit' && installments && installments > 1
    ? `Pago · ${method} em ${installments}x`
    : `Pago · ${method}`;
}

/**
 * BR-FIN-004/021: todo ciclo mostra as despesas fixas ativas para confirmar o pagamento. As
 * pendentes já estão reservadas no saldo do ciclo.
 */
export function FixedExpensesCard({
  expenses,
  payments,
  installmentsByPurchaseId,
  onPay,
  onUndo,
}: FixedExpensesCardProps) {
  // Só fixas ativas com valor no ciclo; pagamentos já feitos continuam aparecendo.
  const rows = expenses
    .map((expense) => {
      const payment = payments.find((item) => item.fixedExpenseId === expense.id);

      return {
        expense,
        payment,
        amount: payment ? payment.amount : calculateFixedExpenseAmount(expense),
      };
    })
    .filter((row) => row.payment || (isActive(row.expense) && row.amount > 0))
    .sort(
      (left, right) =>
        Number(Boolean(left.payment)) - Number(Boolean(right.payment)) ||
        right.amount - left.amount,
    );
  const [isExpanded, setIsExpanded] = useState(false);
  const pending = rows.filter((row) => !row.payment).reduce((total, row) => total + row.amount, 0);
  const paid = rows.filter((row) => row.payment).reduce((total, row) => total + row.amount, 0);

  return (
    <Card>
      <Pressable
        accessibilityLabel="Mostrar ou ocultar despesas fixas do ciclo"
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => setIsExpanded((value) => !value)}
        style={styles.header}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>Despesas fixas do ciclo</Text>
          <Text style={styles.summary}>
            {rows.length === 0
              ? 'Nenhuma despesa fixa neste ciclo.'
              : `Pagas ${formatCurrency(paid)} · Pendentes ${formatCurrency(pending)} (reservadas)`}
          </Text>
        </View>
        <Ionicons
          color={colors.muted}
          name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={22}
        />
      </Pressable>
      {isExpanded ? (
        <>
          {rows.length > 0 ? (
            <Text style={styles.hint}>
              As pendentes já estão reservadas no seu saldo. Pagar à vista não muda o quanto você
              pode gastar; pagar no crédito leva o valor para a fatura do cartão.
            </Text>
          ) : null}
          {rows.map(({ expense, amount, payment }) => (
            <View key={expense.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.name}>
                  {expense.name}
                  {expense.type === 'installment'
                    ? ` (${expense.remainingInstallments}/${expense.totalInstallments})`
                    : ''}
                </Text>
                <Text style={styles.meta}>{expense.category}</Text>
                <Text style={[styles.status, payment ? styles.statusPaid : styles.statusPending]}>
                  {payment
                    ? describePayment(
                        payment,
                        installmentsByPurchaseId[payment.cardPurchaseId ?? ''],
                      )
                    : 'Pendente'}
                </Text>
              </View>
              <View style={styles.rowAction}>
                <Text style={styles.amount}>{formatCurrency(amount)}</Text>
                {payment ? (
                  <AppButton
                    accessibilityLabel={`Desfazer pagamento de ${expense.name}`}
                    onPress={() => onUndo(payment)}
                    style={styles.button}
                    title="Desfazer"
                    variant="ghost"
                  />
                ) : (
                  <AppButton
                    accessibilityLabel={`Pagar ${expense.name}`}
                    iconName="checkmark-outline"
                    onPress={() => onPay(expense)}
                    style={styles.button}
                    title="Pagar"
                    variant="secondary"
                  />
                )}
              </View>
            </View>
          ))}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 44,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  summary: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  status: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusPending: {
    color: colors.warning,
  },
  statusPaid: {
    color: colors.healthy,
  },
  rowAction: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  amount: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  button: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
});
