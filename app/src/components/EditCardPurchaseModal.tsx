import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';

import { CardPurchaseUpdate } from '@manager-money/core/application/card.use-cases';
import { radius, spacing, typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import {
  CardPurchase,
  MAX_CARD_INSTALLMENTS,
} from '@manager-money/core/domain/financial/credit-card';
import { formatDateInput, parseBRDateInput, toISODate } from '@manager-money/core/utils/date';
import { AppButton } from './AppButton';
import { CurrencyInput } from './CurrencyInput';
import { SelectField } from './SelectField';
import { TextInputField } from './TextInputField';

type EditCardPurchaseModalProps = {
  purchase: CardPurchase;
  /** Compra feita no app (no ciclo ativo): pode mudar valor, parcelas e data (BR-FIN-029). */
  canEditAmounts: boolean;
  categories: string[];
  onConfirm: (update: CardPurchaseUpdate) => Promise<void>;
  onClose: () => void;
};

type Errors = Partial<Record<'description' | 'totalAmount' | 'installments' | 'date', string>>;

/** BR-FIN-029: edição de compra no cartão. Compras anteriores ao app mudam descrição, categoria e data (informativa; BR-FIN-036). */
export function EditCardPurchaseModal({
  purchase,
  canEditAmounts,
  categories,
  onConfirm,
  onClose,
}: EditCardPurchaseModalProps) {
  const styles = useStyles();
  const [description, setDescription] = useState(purchase.description);
  const [category, setCategory] = useState(purchase.category);
  const [totalAmount, setTotalAmount] = useState(purchase.totalAmount);
  const [installmentsText, setInstallmentsText] = useState(String(purchase.installments));
  const [dateText, setDateText] = useState(formatDateInput(purchase.purchaseDate));
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);
  const categoryOptions = [...new Set([...categories, purchase.category])].map((value) => ({
    label: value,
    value,
  }));

  async function handleConfirm() {
    const nextErrors: Errors = {};
    const installments = Number(installmentsText.replace(/\D/g, '')) || 0;
    const date = parseBRDateInput(dateText);

    if (!description.trim()) nextErrors.description = 'Informe uma descrição.';

    if (canEditAmounts) {
      if (totalAmount <= 0) nextErrors.totalAmount = 'Informe um valor maior que zero.';
      if (installments < 1 || installments > MAX_CARD_INSTALLMENTS) {
        nextErrors.installments = `Informe de 1 a ${MAX_CARD_INSTALLMENTS} parcelas.`;
      }
    }

    if (!date) {
      nextErrors.date = 'Use o formato DD/MM/AAAA.';
    } else if (!canEditAmounts && toISODate(date) > toISODate(new Date())) {
      nextErrors.date = 'A data da compra não pode ser futura.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);

    try {
      await onConfirm(
        canEditAmounts && date
          ? { description, category, totalAmount, installments, date: toISODate(date) }
          : {
              description,
              category,
              totalAmount: purchase.totalAmount,
              installments: purchase.installments,
              date: date ? toISODate(date) : purchase.purchaseDate,
            },
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
            <Text style={styles.title}>Editar compra</Text>
            <TextInputField
              error={errors.description}
              label="Descrição"
              onChangeText={setDescription}
              value={description}
            />
            <SelectField
              label="Categoria"
              onChange={setCategory}
              options={categoryOptions}
              value={category}
            />
            {canEditAmounts ? (
              <>
                <CurrencyInput
                  error={errors.totalAmount}
                  label="Valor total (com juros)"
                  onChangeValue={setTotalAmount}
                  value={totalAmount}
                />
                <TextInputField
                  error={errors.installments}
                  keyboardType="number-pad"
                  label="Parcelas"
                  maxLength={2}
                  onChangeText={setInstallmentsText}
                  value={installmentsText}
                />
              </>
            ) : (
              <Text style={styles.hint}>
                Compra anterior ao app: valor e parcelas não mudam; a data é só informativa.
              </Text>
            )}
            <TextInputField
              error={errors.date}
              keyboardType="number-pad"
              label="Data da compra"
              maxLength={10}
              onChangeText={setDateText}
              placeholder="DD/MM/AAAA"
              value={dateText}
            />
            <AppButton
              iconName="save-outline"
              isLoading={isSaving}
              onPress={() => void handleConfirm()}
              title="Salvar compra"
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
    fontSize: 13,
    fontWeight: '700',
  },
}));
