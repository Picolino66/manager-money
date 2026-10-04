import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { PayFixedExpenseInput } from '@manager-money/core/application/payment.use-cases';
import { radius, spacing, typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import {
  calculateFirstCycleKey,
  CardLimitUsage,
  CreditCard,
  cycleKeyFromStartDate,
  cycleKeyOffset,
  MAX_CARD_INSTALLMENTS,
  splitInstallments,
  statementDueDate,
  statementKeyForDate,
} from '@manager-money/core/domain/financial/credit-card';
import { describeFirstInstallment } from '../screens/cardText';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { toISODate, formatShortDate } from '@manager-money/core/utils/date';
import { parseISO } from 'date-fns';
import { AppButton } from './AppButton';
import { CardLimitNotice, confirmCardLimit } from './CardLimitNotice';
import { CurrencyInput } from './CurrencyInput';
import { TextInputField } from './TextInputField';

type PayFixedExpenseModalProps = {
  name: string;
  amount: number;
  /** Só cartões ativos (BR-FIN-028). */
  cards: CreditCard[];
  /** Uso do limite por cartão (BR-FIN-026), para mostrar o disponível e avisar estouro. */
  cardLimits: Record<string, CardLimitUsage | null>;
  /** Início do ciclo ativo (yyyy-MM-dd) e dia de pagamento, para prever o ciclo da 1ª parcela. */
  cycleStartDate: string;
  payday: number;
  /** Data do pagamento (yyyy-MM-dd), já limitada ao ciclo. */
  paymentDate: string;
  onConfirm: (input: Omit<PayFixedExpenseInput, 'fixedExpenseId'>) => Promise<void>;
  onClose: () => void;
  onRegisterCard: () => void;
};

/** BR-FIN-021/022: forma de pagamento da despesa fixa; no crédito pede cartão, parcelas e juros. */
export function PayFixedExpenseModal({
  name,
  amount,
  cards,
  cardLimits,
  cycleStartDate,
  payday,
  paymentDate,
  onConfirm,
  onClose,
  onRegisterCard,
}: PayFixedExpenseModalProps) {
  const styles = useStyles();
  const [kind, setKind] = useState<'cash' | 'credit'>('cash');
  const [cardId, setCardId] = useState<string | null>(null);
  const [installmentsText, setInstallmentsText] = useState('1');
  const [interest, setInterest] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const isCredit = kind === 'credit';
  const card = cards.find((item) => item.id === cardId) ?? cards[0] ?? null;
  const installments = Number(installmentsText.replace(/\D/g, '')) || 0;
  const hasValidInstallments = installments >= 1 && installments <= MAX_CARD_INSTALLMENTS;
  const total = amount + interest;
  const cyclesAhead = card
    ? cycleKeyOffset(
        cycleKeyFromStartDate(cycleStartDate),
        calculateFirstCycleKey(
          parseISO(paymentDate),
          card,
          payday,
          cycleKeyFromStartDate(cycleStartDate),
        ),
      )
    : 0;
  const firstInstallment = hasValidInstallments
    ? (splitInstallments(total, installments)[0] ?? 0)
    : 0;
  const statementDue = card
    ? formatShortDate(
        toISODate(
          statementDueDate(statementKeyForDate(parseISO(paymentDate), card.closingDay), card),
        ),
      )
    : '';
  const limitUsage = card ? (cardLimits[card.id] ?? null) : null;
  const canConfirm = !isCredit || (card !== null && hasValidInstallments);

  async function handleConfirm() {
    // BR-FIN-026: estouro do limite só avisa; a pessoa decide continuar.
    if (isCredit && !(await confirmCardLimit(limitUsage, total))) {
      return;
    }

    setIsSaving(true);

    try {
      await onConfirm(
        isCredit
          ? { method: 'credit', cardId: card?.id, installments, interest }
          : { method: 'cash' },
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Pagar {name}</Text>
            <Text style={styles.amount}>{formatCurrency(amount)}</Text>

            <Text style={styles.label}>Forma de pagamento</Text>
            <View style={styles.chips}>
              <Chip
                label="À vista (Pix, dinheiro ou débito)"
                onPress={() => setKind('cash')}
                selected={!isCredit}
              />
              <Chip
                label="Cartão de crédito"
                onPress={() => setKind('credit')}
                selected={isCredit}
              />
            </View>

            {isCredit && cards.length === 0 ? (
              <>
                <Text style={styles.hint}>Cadastre um cartão para pagar no crédito.</Text>
                <AppButton
                  iconName="card-outline"
                  onPress={onRegisterCard}
                  title="Cadastrar cartão"
                  variant="secondary"
                />
              </>
            ) : null}

            {isCredit && card ? (
              <>
                <Text style={styles.label}>Cartão</Text>
                <View style={styles.chips}>
                  {cards.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.name}
                      onPress={() => setCardId(option.id)}
                      selected={option.id === card.id}
                    />
                  ))}
                </View>
                <TextInputField
                  keyboardType="number-pad"
                  label="Parcelas"
                  maxLength={2}
                  onChangeText={setInstallmentsText}
                  value={installmentsText}
                />
                <CurrencyInput
                  label="Juros cobrados (R$)"
                  onChangeValue={setInterest}
                  value={interest}
                />
                <CardLimitNotice amount={total} usage={limitUsage} />
                {hasValidInstallments ? (
                  <Text style={styles.hint}>
                    Total {formatCurrency(total)} em {installments}x de{' '}
                    {formatCurrency(firstInstallment)} · entra na fatura que vence {statementDue} ·{' '}
                    {describeFirstInstallment(cyclesAhead)}.
                  </Text>
                ) : null}
                <Text style={styles.hint}>
                  No crédito, a reserva sai deste ciclo e o valor pesa pela fatura do cartão.
                </Text>
              </>
            ) : null}

            {!isCredit ? (
              <Text style={styles.hint}>
                O valor já estava reservado no saldo do ciclo: pagar à vista não muda o quanto você
                pode gastar.
              </Text>
            ) : null}

            <AppButton
              disabled={!canConfirm}
              iconName="checkmark-circle-outline"
              isLoading={isSaving}
              onPress={() => void handleConfirm()}
              title="Confirmar pagamento"
            />
            <AppButton onPress={onClose} title="Cancelar" variant="ghost" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    maxHeight: '90%',
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  amount: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: '900',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '900',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
}));
