import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PayFixedExpenseInput } from '../application/payment.use-cases';
import { colors, radius, spacing, typography } from '../design/theme';
import {
  calculateFirstCycleKey,
  CreditCard,
  cycleKeyFromStartDate,
  cycleKeyOffset,
  MAX_CARD_INSTALLMENTS,
  splitInstallments,
} from '../domain/financial/credit-card';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PaymentMethod,
} from '../domain/financial/payments';
import { describeFirstInstallment } from '../screens/cardText';
import { formatCurrency } from '../utils/currency';
import { parseISO } from 'date-fns';
import { AppButton } from './AppButton';
import { CurrencyInput } from './CurrencyInput';
import { TextInputField } from './TextInputField';

type PayFixedExpenseModalProps = {
  name: string;
  amount: number;
  cards: CreditCard[];
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
  cycleStartDate,
  payday,
  paymentDate,
  onConfirm,
  onClose,
  onRegisterCard,
}: PayFixedExpenseModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [cardId, setCardId] = useState<string | null>(null);
  const [installmentsText, setInstallmentsText] = useState('1');
  const [interest, setInterest] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const isCredit = method === 'credit';
  const card = cards.find((item) => item.id === cardId) ?? cards[0] ?? null;
  const installments = Number(installmentsText.replace(/\D/g, '')) || 0;
  const hasValidInstallments = installments >= 1 && installments <= MAX_CARD_INSTALLMENTS;
  const total = amount + interest;
  const cyclesAhead = card
    ? cycleKeyOffset(
        cycleKeyFromStartDate(cycleStartDate),
        calculateFirstCycleKey(
          parseISO(paymentDate),
          card.closingDay,
          payday,
          cycleKeyFromStartDate(cycleStartDate),
        ),
      )
    : 0;
  const firstInstallment = hasValidInstallments ? (splitInstallments(total, installments)[0] ?? 0) : 0;
  const canConfirm = !isCredit || (card !== null && hasValidInstallments);

  async function handleConfirm() {
    setIsSaving(true);

    try {
      await onConfirm(
        isCredit
          ? { method, cardId: card?.id, installments, interest }
          : { method },
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
              {PAYMENT_METHODS.map((option) => (
                <Chip
                  key={option}
                  label={PAYMENT_METHOD_LABELS[option]}
                  onPress={() => setMethod(option)}
                  selected={method === option}
                />
              ))}
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
                {hasValidInstallments ? (
                  <Text style={styles.hint}>
                    Total {formatCurrency(total)} em {installments}x de{' '}
                    {formatCurrency(firstInstallment)} · {describeFirstInstallment(cyclesAhead)}.
                  </Text>
                ) : null}
              </>
            ) : null}

            {!isCredit ? (
              <Text style={styles.hint}>O valor sai da renda deste ciclo agora.</Text>
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

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
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

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
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
});
