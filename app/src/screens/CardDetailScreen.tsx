import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAfter, parseISO, startOfDay } from 'date-fns';

import {
  canModifyCardPurchase,
  CardPurchaseUpdate,
  CreditCardInput,
} from '../application/card.use-cases';
import {
  selectCardLimitUsage,
  selectCardStatements,
  selectCreditCards,
} from '../application/selectors';
import { AppButton } from '../components/AppButton';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { CardForm } from '../components/CardForm';
import { CardLimitBar } from '../components/CardLimitBar';
import { EditCardPurchaseModal } from '../components/EditCardPurchaseModal';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { PayStatementModal } from '../components/PayStatementModal';
import { Screen } from '../components/Screen';
import { StatementCard } from '../components/StatementCard';
import { StatementChargesModal } from '../components/StatementChargesModal';
import { spacing, typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import {
  CardPurchase,
  CardStatement,
  cycleKeyFromStartDate,
} from '../domain/financial/credit-card';
import { getSortedCategories } from '../domain/financial/financial.calculations';
import { isActive } from '../domain/financial/financial.types';
import { RootStackParamList } from '../navigation/types';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '../utils/currency';
import {
  CARD_LIMIT_DISCLAIMER,
  describeCycleWeight,
  describeStatementEntry,
  formatMonthKey,
} from './cardText';
import {
  buildCardStatementsView,
  formatDayMonth,
  statementCycleKeys,
  weightByCycle,
} from './cardView';

type Props = NativeStackScreenProps<RootStackParamList, 'CardDetail'>;

function showError(title: string, error: unknown) {
  Alert.alert(title, error instanceof Error ? error.message : 'Tente novamente.');
}

/**
 * SPEC-016/019: visão do cartão — limite, faturas, compras, pagamentos (inclusive parciais) e
 * juros/multas de fatura (BR-FIN-025/026/029/032/033).
 */
export function CardDetailScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const doc = useFinancialStore((state) => state.doc);
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const saveCreditCard = useFinancialStore((state) => state.saveCreditCard);
  const setCreditCardActive = useFinancialStore((state) => state.setCreditCardActive);
  const payStatement = useFinancialStore((state) => state.payStatement);
  const addStatementCharges = useFinancialStore((state) => state.addStatementCharges);
  const undoStatementPayment = useFinancialStore((state) => state.undoStatementPayment);
  const updateCardPurchase = useFinancialStore((state) => state.updateCardPurchase);
  const deleteCardPurchase = useFinancialStore((state) => state.deleteCardPurchase);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [payingStatement, setPayingStatement] = useState<CardStatement | null>(null);
  const [chargingStatement, setChargingStatement] = useState<CardStatement | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<CardPurchase | null>(null);
  const card = selectCreditCards(doc).find((item) => item.id === route.params.cardId);

  if (!card) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Voltar"
          iconName="alert-circle-outline"
          message="Este cartão não existe mais neste aparelho."
          onActionPress={() => navigation.goBack()}
          title="Cartão não encontrado"
        />
      </Screen>
    );
  }

  const cardId = card.id;
  const today = new Date();
  const active = isActive(card);
  const usage = selectCardLimitUsage(doc, cardId);
  const statements = selectCardStatements(doc, cardId, today);
  const view = buildCardStatementsView(card, statements, today, activeMonth?.id ?? null);
  const activeCycleKey = activeMonth ? cycleKeyFromStartDate(activeMonth.startDate) : null;
  const weights = weightByCycle(statements, activeCycleKey);
  const categories = getSortedCategories(config);
  const cycleText = (statement: CardStatement) =>
    describeCycleWeight(
      statementCycleKeys(statement, card, config?.payday ?? null, activeCycleKey),
    );
  const isOverdue = (statement: CardStatement) =>
    isAfter(startOfDay(today), startOfDay(parseISO(statement.dueDate)));
  const isLocked = (purchase: CardPurchase) => !canModifyCardPurchase(doc, purchase);
  /** Espelha o caso de uso: compra feita no app (não da situação inicial), no ciclo ativo (BR-FIN-029). */
  const canEditAmounts = (purchase: CardPurchase) =>
    Boolean(
      activeMonth &&
      purchase.origin !== 'existing' &&
      purchase.purchaseDate >= activeMonth.startDate &&
      purchase.purchaseDate <= activeMonth.endDate,
    );

  async function handleSaveCard(input: CreditCardInput) {
    try {
      await saveCreditCard(input);
      setIsEditingCard(false);
    } catch (error) {
      showError('Não foi possível salvar o cartão', error);
    }
  }

  function handleToggleActive() {
    setCreditCardActive(cardId, !active).catch((error: unknown) =>
      showError('Não foi possível atualizar o cartão', error),
    );
  }

  async function handleConfirmPay(paidAmount: number | undefined) {
    if (!payingStatement) return;

    try {
      await payStatement({
        cardId,
        statementKey: payingStatement.key,
        ...(paidAmount === undefined ? {} : { paidAmount }),
      });
      setPayingStatement(null);
    } catch (error) {
      showError('Não foi possível registrar o pagamento', error);
    }
  }

  async function handleConfirmCharges(amount: number) {
    if (!chargingStatement) return;

    try {
      await addStatementCharges({ cardId, statementKey: chargingStatement.key, amount });
      setChargingStatement(null);
    } catch (error) {
      showError('Não foi possível registrar os juros/multa', error);
    }
  }

  function handleUndo(paymentId: string) {
    undoStatementPayment(paymentId).catch((error: unknown) =>
      showError('Não foi possível desfazer o lançamento', error),
    );
  }

  async function handleUpdatePurchase(update: CardPurchaseUpdate) {
    if (!editingPurchase) return;

    try {
      await updateCardPurchase(editingPurchase.id, update);
      setEditingPurchase(null);
    } catch (error) {
      showError('Não foi possível salvar a compra', error);
    }
  }

  function handleDeletePurchase(purchase: CardPurchase) {
    Alert.alert(
      'Excluir compra?',
      `${purchase.description} (todas as parcelas) será removida das faturas e o limite volta a ficar livre.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            deleteCardPurchase(purchase.id).catch((error: unknown) =>
              showError('Não foi possível excluir', error),
            );
          },
        },
      ],
    );
  }

  function renderEntries(statement: CardStatement) {
    if (statement.payments.length === 0) return null;

    const monthLabel = formatMonthKey(statement.key);

    return (
      <View style={styles.entries}>
        <Text style={styles.entriesTitle}>Lançamentos</Text>
        {statement.payments.map((payment) => {
          const text = describeStatementEntry(payment, formatDayMonth(payment.paidAt));

          return (
            <View key={payment.id} style={styles.entryRow}>
              <Text style={styles.entryText}>{text}</Text>
              {payment.cycleId === activeMonth?.id ? (
                <AppButton
                  accessibilityLabel={`Desfazer lançamento ${text} da fatura ${monthLabel}`}
                  iconName="arrow-undo-outline"
                  onPress={() => handleUndo(payment.id)}
                  title="Desfazer"
                  variant="ghost"
                />
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  function renderPaymentArea(statement: CardStatement) {
    const entries = renderEntries(statement);
    const monthLabel = formatMonthKey(statement.key);

    if (statement.status === 'paid') {
      const last = statement.payments[statement.payments.length - 1];

      return (
        <View style={styles.paymentArea}>
          <Text style={styles.paid}>Quitada{last ? ` em ${formatDayMonth(last.paidAt)}` : ''}</Text>
          {entries}
        </View>
      );
    }

    if (statement.status === 'open') {
      return (
        <Text style={styles.hint}>
          Fatura aberta: recebe compras até {formatDayMonth(statement.closingDate)}.
        </Text>
      );
    }

    if (statement.remaining <= 0) return entries;

    if (!activeMonth) {
      return (
        <View style={styles.paymentArea}>
          <Text style={styles.hint}>
            Para registrar o pagamento da fatura, é preciso iniciar o ciclo.
          </Text>
          <AppButton
            onPress={() => navigation.navigate('StartMonth')}
            title="Iniciar ciclo"
            variant="secondary"
          />
          {entries}
        </View>
      );
    }

    return (
      <View style={styles.paymentArea}>
        {isOverdue(statement) ? (
          <Text style={styles.overdue}>
            Venceu em {formatDayMonth(statement.dueDate)}. Ao registrar o pagamento, informe o valor
            pago, com juros se houver.
          </Text>
        ) : null}
        {statement.status === 'partial' ? (
          <Text style={styles.partial}>
            Pagamento parcial: faltam {formatCurrency(statement.remaining)}. O restante continua
            devido; se a fatura pesa no ciclo atual, o que faltar ao fechar vira dívida do próximo.
          </Text>
        ) : null}
        {entries}
        <AppButton
          accessibilityLabel={`Paguei a fatura ${monthLabel}`}
          iconName="checkmark-done-outline"
          onPress={() => setPayingStatement(statement)}
          title="Paguei a fatura"
        />
        <AppButton
          accessibilityLabel={`Registrar juros/multa da fatura ${monthLabel}`}
          iconName="add-circle-outline"
          onPress={() => setChargingStatement(statement)}
          title="Registrar juros/multa"
          variant="secondary"
        />
      </View>
    );
  }

  const statementProps = {
    isPurchaseLocked: isLocked,
    onEditPurchase: setEditingPurchase,
    onDeletePurchase: handleDeletePurchase,
  };

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{card.name}</Text>
        {!active ? <Badge label="Inativo" /> : null}
      </View>
      <Text style={styles.hint}>
        Fecha dia {card.closingDay} · Vence dia {card.dueDay}
        {!active ? ' · Não aparece em novas compras; as parcelas continuam valendo.' : ''}
      </Text>

      {isEditingCard ? (
        <CardForm card={card} onCancel={() => setIsEditingCard(false)} onSubmit={handleSaveCard} />
      ) : (
        <View style={styles.actions}>
          <AppButton
            iconName="create-outline"
            onPress={() => setIsEditingCard(true)}
            style={styles.actionButton}
            title="Editar cartão"
            variant="secondary"
          />
          <AppButton
            iconName={active ? 'pause-circle-outline' : 'play-circle-outline'}
            onPress={handleToggleActive}
            style={styles.actionButton}
            title={active ? 'Desativar' : 'Ativar'}
            variant="secondary"
          />
        </View>
      )}

      <Card>
        <Text style={styles.sectionTitle}>Quanto ainda posso usar deste cartão?</Text>
        <MetricRow
          label="Limite total"
          value={
            usage && usage.creditLimit !== null
              ? formatCurrency(usage.creditLimit)
              : 'Não informado'
          }
        />
        <MetricRow label="Limite comprometido" value={formatCurrency(usage?.committed ?? 0)} />
        {usage && usage.available !== null ? (
          <>
            <MetricRow
              label="Limite disponível do cartão"
              tone={usage.available < 0 ? 'negative' : 'positive'}
              value={formatCurrency(usage.available)}
            />
            <CardLimitBar committed={usage.committed} creditLimit={usage.creditLimit} />
          </>
        ) : (
          <Text style={styles.hint}>
            Limite não informado. Informe o limite em &quot;Editar cartão&quot; para acompanhar o
            disponível.
          </Text>
        )}
        <Text style={styles.hint}>
          Comprometido = parcelas das faturas, inclusive futuras, menos o que já foi pago de cada
          fatura. Pagamento parcial libera parte do limite; juros e multas não ocupam limite.
        </Text>
        <Text style={styles.disclaimer}>{CARD_LIMIT_DISCLAIMER}</Text>
      </Card>

      {!activeMonth ? (
        <Card style={styles.warningCard}>
          <Text style={styles.hint}>
            Sem ciclo ativo: inicie o ciclo para registrar pagamentos de fatura e ver em qual ciclo
            cada fatura pesa.
          </Text>
          <AppButton
            onPress={() => navigation.navigate('StartMonth')}
            title="Iniciar ciclo"
            variant="secondary"
          />
        </Card>
      ) : null}

      <StatementCard
        {...statementProps}
        cycleText={cycleText(view.current)}
        defaultExpanded
        footer={renderPaymentArea(view.current)}
        statement={view.current}
        title="Fatura atual"
      />
      <StatementCard
        {...statementProps}
        cycleText={cycleText(view.next)}
        footer={renderPaymentArea(view.next)}
        statement={view.next}
        title="Próxima fatura"
      />

      {view.future.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            {view.future.every((statement) => statement.status === 'open')
              ? 'Faturas futuras'
              : 'Outras faturas'}
          </Text>
          {view.future.map((statement) => (
            <StatementCard
              {...statementProps}
              cycleText={cycleText(statement)}
              footer={statement.status === 'open' ? undefined : renderPaymentArea(statement)}
              key={statement.key}
              statement={statement}
              title={`Vence ${formatDayMonth(statement.dueDate)}`}
            />
          ))}
        </>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Quanto vai pesar nos próximos ciclos?</Text>
        {weights.length === 0 ? (
          <Text style={styles.hint}>Nenhuma parcela em aberto neste cartão.</Text>
        ) : (
          weights.map((item) => (
            <MetricRow
              key={item.cycleKey}
              label={`Ciclo de ${formatMonthKey(item.cycleKey)}${item.cycleKey === activeCycleKey ? ' (atual)' : ''}`}
              value={formatCurrency(item.amount)}
            />
          ))
        )}
        <Text style={styles.hint}>
          Cada fatura pesa no ciclo em que vence e já sai do que você pode gastar nesse ciclo.
        </Text>
      </Card>

      {view.paidInActiveCycle.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Quitadas neste ciclo</Text>
          {view.paidInActiveCycle.map((statement) => (
            <StatementCard
              {...statementProps}
              cycleText={cycleText(statement)}
              footer={renderPaymentArea(statement)}
              key={statement.key}
              statement={statement}
              title={`Fatura ${formatMonthKey(statement.key)}`}
            />
          ))}
        </>
      ) : null}

      <AppButton
        iconName="time-outline"
        onPress={() => navigation.navigate('CardDebt', { cardId })}
        title="Compras anteriores ao app"
        variant="secondary"
      />
      <Text style={styles.hint}>
        Fatura em aberto ou parcelamento que já existia antes de você usar o app.
      </Text>

      {payingStatement ? (
        <PayStatementModal
          amount={payingStatement.amount}
          charges={payingStatement.charges}
          dueLabel={formatDayMonth(payingStatement.dueDate)}
          onClose={() => setPayingStatement(null)}
          onConfirm={handleConfirmPay}
          overdue={isOverdue(payingStatement)}
          paid={payingStatement.paid}
          remaining={payingStatement.remaining}
          title={`Fatura ${card.name} ${formatMonthKey(payingStatement.key)}`}
        />
      ) : null}

      {chargingStatement ? (
        <StatementChargesModal
          onClose={() => setChargingStatement(null)}
          onConfirm={handleConfirmCharges}
          title={`Juros/multa da fatura ${card.name} ${formatMonthKey(chargingStatement.key)}`}
        />
      ) : null}

      {editingPurchase ? (
        <EditCardPurchaseModal
          canEditAmounts={canEditAmounts(editingPurchase)}
          categories={categories}
          onClose={() => setEditingPurchase(null)}
          onConfirm={handleUpdatePurchase}
          purchase={editingPurchase}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
  },
  disclaimer: {
    color: colors.info,
    fontSize: 13,
    fontWeight: '700',
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  paymentArea: {
    gap: spacing.sm,
  },
  paid: {
    color: colors.healthy,
    fontSize: 14,
    fontWeight: '800',
  },
  partial: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
  },
  entries: {
    gap: spacing.xs,
  },
  entriesTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  entryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  entryText: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  overdue: {
    color: colors.critical,
    fontSize: 13,
    fontWeight: '700',
  },
}));
