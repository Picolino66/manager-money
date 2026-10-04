import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../design/theme';
import { MoneyCents } from '../domain/financial/financial.types';
import { formatCurrency } from '../utils/currency';
import { AppButton } from './AppButton';
import { CurrencyInput } from './CurrencyInput';

type PayStatementModalProps = {
  /** Ex.: "Fatura Nubank 10/2026". */
  title: string;
  amount: MoneyCents;
  /** Vencimento já formatado (dd/MM). */
  dueLabel: string;
  onConfirm: (paidAmount: MoneyCents) => Promise<void>;
  onClose: () => void;
};

/**
 * BR-FIN-026: pagamento de fatura vencida. Pede o valor efetivamente pago (≥ valor da fatura); a
 * diferença são juros e pesa no ciclo atual.
 */
export function PayStatementModal({
  title,
  amount,
  dueLabel,
  onConfirm,
  onClose,
}: PayStatementModalProps) {
  const [paidAmount, setPaidAmount] = useState<MoneyCents>(amount);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const interest = Math.max(0, paidAmount - amount);

  async function handleConfirm() {
    if (paidAmount < amount) {
      setError('O valor pago não pode ser menor que o valor da fatura.');
      return;
    }

    setError(undefined);
    setIsSaving(true);

    try {
      await onConfirm(paidAmount);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.hint}>
              A fatura de {formatCurrency(amount)} venceu em {dueLabel}. Informe quanto você pagou,
              com os juros. A diferença para o valor da fatura são juros e pesa no ciclo atual.
            </Text>
            <CurrencyInput
              error={error}
              label="Valor pago (com juros)"
              onChangeValue={setPaidAmount}
              value={paidAmount}
            />
            <Text style={styles.interest}>Juros: {formatCurrency(interest)}</Text>
            <AppButton
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
  hint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  interest: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '800',
  },
});
