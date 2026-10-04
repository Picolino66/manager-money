import { useState } from 'react';
import { Text } from 'react-native';

import { CreditCardInput } from '../application/card.use-cases';
import { typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import { CreditCard, MAX_CARD_DAY, MIN_CARD_DAY } from '../domain/financial/credit-card';
import { MoneyCents } from '../domain/financial/financial.types';
import { AppButton } from './AppButton';
import { Card } from './Card';
import { CurrencyInput } from './CurrencyInput';
import { TextInputField } from './TextInputField';

type CardFormProps = {
  /** Cartão em edição; ausente = novo cartão. */
  card?: CreditCard;
  onSubmit: (input: CreditCardInput) => Promise<void>;
  onCancel: () => void;
};

type Errors = Partial<Record<'name' | 'closingDay' | 'dueDay', string>>;

function toDay(value: string): number {
  return Number(value.replace(/\D/g, '')) || 0;
}

const isValidDay = (day: number) => day >= MIN_CARD_DAY && day <= MAX_CARD_DAY;

/** BR-FIN-019/026/028: formulário do cartão com limite total opcional. */
export function CardForm({ card, onSubmit, onCancel }: CardFormProps) {
  const styles = useStyles();
  const [name, setName] = useState(card?.name ?? '');
  const [closingDay, setClosingDay] = useState(card ? String(card.closingDay) : '');
  const [dueDay, setDueDay] = useState(card ? String(card.dueDay) : '');
  const [creditLimit, setCreditLimit] = useState<MoneyCents>(card?.creditLimit ?? 0);
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const nextErrors: Errors = {};
    const closing = toDay(closingDay);
    const due = toDay(dueDay);

    if (!name.trim()) nextErrors.name = 'Informe o nome do cartão.';
    if (!isValidDay(closing)) nextErrors.closingDay = 'Informe um dia entre 1 e 28.';
    if (!isValidDay(due)) nextErrors.dueDay = 'Informe um dia entre 1 e 28.';

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);

    try {
      await onSubmit({
        id: card?.id,
        name,
        closingDay: closing,
        dueDay: due,
        creditLimit: creditLimit > 0 ? creditLimit : null,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <Text style={styles.title}>{card ? 'Editar cartão' : 'Novo cartão'}</Text>
      <TextInputField
        autoCapitalize="words"
        error={errors.name}
        label="Nome do cartão"
        onChangeText={setName}
        placeholder="Ex: Nubank"
        value={name}
      />
      <TextInputField
        error={errors.closingDay}
        keyboardType="number-pad"
        label="Dia de fechamento (1 a 28)"
        maxLength={2}
        onChangeText={setClosingDay}
        value={closingDay}
      />
      <TextInputField
        error={errors.dueDay}
        keyboardType="number-pad"
        label="Dia de vencimento (1 a 28)"
        maxLength={2}
        onChangeText={setDueDay}
        value={dueDay}
      />
      <CurrencyInput
        label="Limite total do cartão (opcional)"
        onChangeValue={setCreditLimit}
        placeholder="Não informado"
        value={creditLimit}
      />
      <Text style={styles.hint}>
        O limite serve para acompanhar o uso do cartão. Ele não é dinheiro para gastar.
      </Text>
      {card ? (
        <Text style={styles.hint}>
          Mudar fechamento ou vencimento vale só para compras novas; as já registradas continuam nas
          faturas de antes.
        </Text>
      ) : null}
      <AppButton
        iconName="save-outline"
        isLoading={isSaving}
        onPress={() => void handleSave()}
        title="Salvar cartão"
      />
      <AppButton onPress={onCancel} title="Cancelar" variant="ghost" />
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  title: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
  },
}));
