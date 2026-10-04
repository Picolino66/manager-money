import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';

import { radius, spacing, typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import { MoneyCents } from '../domain/financial/financial.types';
import { formatCurrency } from '../utils/currency';
import { AppButton } from './AppButton';
import { CurrencyInput } from './CurrencyInput';

type PayStatementModalProps = {
  /** Ex.: "Fatura Nubank 10/2026". */
  title: string;
  /** Principal da fatura. */
  amount: MoneyCents;
  /** Encargos já reconhecidos. */
  charges: MoneyCents;
  /** Total já pago. */
  paid: MoneyCents;
  /** Ainda a pagar (principal + encargos − pago). */
  remaining: MoneyCents;
  /** Vencimento já formatado (dd/MM). */
  dueLabel: string;
  /** Passou do vencimento: o valor pago passa a ser obrigatório (BR-FIN-033). */
  overdue: boolean;
  /** `undefined` = quitar o restante (só antes do vencimento). */
  onConfirm: (paidAmount: MoneyCents | undefined) => Promise<void>;
  onClose: () => void;
};

/**
 * BR-FIN-033/034: pagamento de fatura. Valor menor que o restante é parcial (o resto vira dívida do
 * próximo ciclo se não for pago até o fim do ciclo); maior que o restante registra a diferença como
 * juros/encargos no ciclo atual.
 */
export function PayStatementModal({
  title,
  amount,
  charges,
  paid,
  remaining,
  dueLabel,
  overdue,
  onConfirm,
  onClose,
}: PayStatementModalProps) {
  const styles = useStyles();
  const [paidAmount, setPaidAmount] = useState<MoneyCents>(remaining);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const shortfall = paidAmount > 0 ? Math.max(0, remaining - paidAmount) : 0;
  const excess = Math.max(0, paidAmount - remaining);

  async function submit(value: MoneyCents | undefined) {
    if (value !== undefined && value <= 0) {
      setError('Informe um valor pago maior que zero.');
      return;
    }

    setError(undefined);
    setIsSaving(true);

    try {
      await onConfirm(value);
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
            <Text style={styles.summary}>
              Fatura {formatCurrency(amount)}
              {charges > 0 ? ` · Encargos ${formatCurrency(charges)}` : ''} · Já pago{' '}
              {formatCurrency(paid)} · Restante {formatCurrency(remaining)}
            </Text>
            <Text style={styles.hint}>
              {overdue
                ? `A fatura venceu em ${dueLabel}. Informe quanto você pagou, com juros se houver.`
                : `Vence em ${dueLabel}. Informe quanto você pagou.`}
            </Text>
            {!overdue ? (
              <AppButton
                iconName="checkmark-done-outline"
                isLoading={isSaving}
                onPress={() => void submit(undefined)}
                title={`Pagar o restante (${formatCurrency(remaining)})`}
              />
            ) : null}
            <CurrencyInput
              error={error}
              label="Valor pago"
              onChangeValue={setPaidAmount}
              value={paidAmount}
            />
            <View accessibilityLiveRegion="polite">
              {shortfall > 0 ? (
                <Text style={styles.warning}>
                  Pagamento parcial: {formatCurrency(shortfall)} continuam devidos. Se a fatura pesa
                  no ciclo atual, o que faltar ao fechar o ciclo vira dívida do próximo.
                </Text>
              ) : null}
              {excess > 0 ? (
                <Text style={styles.warning}>
                  {formatCurrency(excess)} serão registrados como juros/encargos e saem do orçamento
                  deste ciclo.
                </Text>
              ) : null}
            </View>
            <AppButton
              iconName="checkmark-circle-outline"
              isLoading={isSaving}
              onPress={() => void submit(paidAmount)}
              title="Confirmar pagamento"
              variant={overdue ? 'primary' : 'secondary'}
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
  summary: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  hint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  warning: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '800',
  },
}));
