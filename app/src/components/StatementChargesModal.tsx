import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';

import { radius, spacing, typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { AppButton } from './AppButton';
import { CurrencyInput } from './CurrencyInput';

type StatementChargesModalProps = {
  /** Ex.: "Juros/multa da fatura Nubank 10/2026". */
  title: string;
  onConfirm: (amount: MoneyCents) => Promise<void>;
  onClose: () => void;
};

/**
 * BR-FIN-033: registra juros/multa informados pelo banco. Aumentam o que falta pagar da fatura e
 * saem do orçamento do ciclo atual.
 */
export function StatementChargesModal({ title, onConfirm, onClose }: StatementChargesModalProps) {
  const styles = useStyles();
  const [amount, setAmount] = useState<MoneyCents>(0);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirm() {
    if (amount <= 0) {
      setError('Informe o valor dos juros ou da multa.');
      return;
    }

    setError(undefined);
    setIsSaving(true);

    try {
      await onConfirm(amount);
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
              Os juros/multa aumentam o que falta pagar desta fatura e saem do orçamento deste
              ciclo.
            </Text>
            <CurrencyInput
              error={error}
              label="Valor dos juros/multa"
              onChangeValue={setAmount}
              value={amount}
            />
            <AppButton
              iconName="add-circle-outline"
              isLoading={isSaving}
              onPress={() => void handleConfirm()}
              title="Confirmar juros/multa"
            />
            <AppButton onPress={onClose} title="Cancelar" variant="ghost" />
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  hint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
}));
