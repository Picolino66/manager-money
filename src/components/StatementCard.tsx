import { ReactNode, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../design/theme';
import { CardPurchase, CardStatement, StatementStatus } from '../domain/financial/credit-card';
import {
  formatMonthKey,
  PURCHASE_LOCKED_REASON,
  STATEMENT_STATUS_LABEL,
} from '../screens/cardText';
import { formatDayMonth } from '../screens/cardView';
import { formatCurrency } from '../utils/currency';
import { Badge, BadgeTone } from './Badge';
import { Card } from './Card';
import { MetricRow } from './MetricRow';

const STATUS_TONE: Record<StatementStatus, BadgeTone> = {
  open: 'info',
  closed: 'warning',
  overdue: 'critical',
  paid: 'positive',
};

type StatementCardProps = {
  /** Ex.: "Fatura atual". */
  title: string;
  statement: CardStatement;
  /** Ex.: "pesa no ciclo de 10/2026". */
  cycleText: string;
  defaultExpanded?: boolean;
  /** Área de pagamento ("Paguei a fatura", "Paga em…", "Desfazer"). */
  footer?: ReactNode;
  isPurchaseLocked: (purchase: CardPurchase) => boolean;
  onEditPurchase: (purchase: CardPurchase) => void;
  onDeletePurchase: (purchase: CardPurchase) => void;
};

/** BR-FIN-025/026/029: fatura com valor, datas, status, ciclo em que pesa e compras. */
export function StatementCard({
  title,
  statement,
  cycleText,
  defaultExpanded = false,
  footer,
  isPurchaseLocked,
  onEditPurchase,
  onDeletePurchase,
}: StatementCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const monthLabel = formatMonthKey(statement.key);
  const count = statement.installments.length;
  const hasLocked = statement.installments.some((item) => isPurchaseLocked(item.purchase));

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>Fatura {monthLabel}</Text>
        </View>
        <Badge
          label={STATEMENT_STATUS_LABEL[statement.status]}
          tone={STATUS_TONE[statement.status]}
        />
      </View>
      <Text style={styles.amount}>{formatCurrency(statement.amount)}</Text>
      <MetricRow label="Fechamento" value={formatDayMonth(statement.closingDate)} />
      <MetricRow label="Vencimento" value={formatDayMonth(statement.dueDate)} />
      {cycleText ? <Text style={styles.cycle}>{cycleText}</Text> : null}
      {footer}

      {count > 0 ? (
        <Pressable
          accessibilityLabel={`${expanded ? 'Ocultar' : 'Ver'} compras da fatura ${monthLabel}`}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>
            {expanded ? 'Ocultar compras' : `Ver compras (${count})`}
          </Text>
          <Ionicons
            color={colors.primary}
            name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={18}
          />
        </Pressable>
      ) : (
        <Text style={styles.meta}>Nenhuma compra nesta fatura.</Text>
      )}

      {expanded
        ? statement.installments.map((item) => {
            const locked = isPurchaseLocked(item.purchase);

            return (
              <View key={`${item.purchase.id}-${item.number}`} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.purchase.description}</Text>
                  <Text style={styles.meta}>
                    Parcela {item.number}/{item.purchase.installments} ·{' '}
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
                {locked ? (
                  <View
                    accessibilityLabel={`${item.purchase.description}: bloqueada`}
                    style={styles.locked}
                  >
                    <Ionicons color={colors.muted} name="lock-closed-outline" size={16} />
                    <Text style={styles.meta}>Bloqueada</Text>
                  </View>
                ) : (
                  <>
                    <Pressable
                      accessibilityLabel={`Editar compra ${item.purchase.description}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => onEditPurchase(item.purchase)}
                      style={styles.iconButton}
                    >
                      <Ionicons color={colors.primary} name="create-outline" size={20} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Excluir compra ${item.purchase.description}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => onDeletePurchase(item.purchase)}
                      style={styles.iconButton}
                    >
                      <Ionicons color={colors.critical} name="trash-outline" size={20} />
                    </Pressable>
                  </>
                )}
              </View>
            );
          })
        : null}
      {expanded && hasLocked ? <Text style={styles.meta}>{PURCHASE_LOCKED_REASON}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  amount: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  cycle: {
    color: colors.info,
    fontSize: 13,
    fontWeight: '800',
  },
  toggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 44,
  },
  toggleText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  row: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  locked: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
