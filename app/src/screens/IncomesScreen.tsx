import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { CurrencyInput } from '../components/CurrencyInput';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import { spacing, typography } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';
import { selectCycleExtraIncomes } from '@manager-money/core/application/selectors';
import { RootStackParamList } from '../navigation/types';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { clampIsoDate, formatCycleLabel, formatDateInput, parseBRDateInput, toISODate } from '@manager-money/core/utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'Incomes'>;

function showError(title: string, error: unknown) {
  Alert.alert(title, error instanceof Error ? error.message : 'Tente novamente.');
}

/** BR-FIN-023: rendas avulsas do ciclo ativo (somam ao saldo disponível). */
export function IncomesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const doc = useFinancialStore((state) => state.doc);
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const addExtraIncome = useFinancialStore((state) => state.addExtraIncome);
  const deleteExtraIncome = useFinancialStore((state) => state.deleteExtraIncome);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [dateText, setDateText] = useState('');
  const [errors, setErrors] = useState<{ name?: string; amount?: string; date?: string }>({});

  if (!activeMonth || !config) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Iniciar ciclo"
          iconName="play-circle-outline"
          message="Abra um ciclo mensal antes de lançar rendas."
          onActionPress={() => navigation.navigate('StartMonth')}
          title="Nenhum ciclo ativo"
        />
      </Screen>
    );
  }

  const incomes = selectCycleExtraIncomes(doc, activeMonth.id).sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const extraTotal = incomes.reduce((total, income) => total + income.amount, 0);

  function startAdding() {
    if (!activeMonth) return;

    setName('');
    setAmount(0);
    setDateText(
      formatDateInput(clampIsoDate(toISODate(new Date()), activeMonth.startDate, activeMonth.endDate)),
    );
    setErrors({});
    setIsAdding(true);
  }

  async function handleSave() {
    if (!activeMonth) return;

    const nextErrors: typeof errors = {};
    const parsedDate = parseBRDateInput(dateText);

    if (!name.trim()) nextErrors.name = 'Informe o nome da renda.';
    if (amount <= 0) nextErrors.amount = 'Informe um valor maior que zero.';
    if (!parsedDate) nextErrors.date = 'Use o formato DD/MM/AAAA.';

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !parsedDate) {
      return;
    }

    try {
      await addExtraIncome({ name, amount, date: toISODate(parsedDate) });
      setIsAdding(false);
    } catch (error) {
      showError('Não foi possível salvar', error);
    }
  }

  function handleDelete(id: string, incomeName: string) {
    Alert.alert('Excluir renda?', `${incomeName} deixará de somar ao saldo do ciclo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteExtraIncome(id).catch((error: unknown) => showError('Não foi possível excluir', error));
        },
      },
    ]);
  }

  return (
    <Screen>
      <Text style={styles.title}>Rendas do ciclo</Text>
      <Text style={styles.cycle}>{formatCycleLabel(activeMonth.startDate, activeMonth.endDate)}</Text>

      <Card>
        <MetricRow label="Renda mensal (fontes)" value={formatCurrency(config.monthlyIncome)} />
        <MetricRow label="Rendas avulsas" value={formatCurrency(extraTotal)} />
      </Card>

      {incomes.length === 0 && !isAdding ? (
        <Text style={styles.empty}>Nenhuma renda avulsa neste ciclo.</Text>
      ) : null}

      {incomes.map((income) => (
        <Card key={income.id}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.name}>{income.name}</Text>
              <Text style={styles.meta}>
                {formatDateInput(income.date)} · {formatCurrency(income.amount)}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Excluir renda ${income.name}`}
              accessibilityRole="button"
              onPress={() => handleDelete(income.id, income.name)}
            >
              <Ionicons color={colors.critical} name="trash-outline" size={20} />
            </Pressable>
          </View>
        </Card>
      ))}

      {isAdding ? (
        <Card>
          <Text style={styles.sectionTitle}>Nova renda</Text>
          <TextInputField
            autoCapitalize="sentences"
            error={errors.name}
            label="Nome da renda"
            onChangeText={setName}
            placeholder="Ex: freela, 13º, venda"
            value={name}
          />
          <CurrencyInput error={errors.amount} label="Valor" onChangeValue={setAmount} value={amount} />
          <TextInputField
            error={errors.date}
            label="Data do recebimento"
            onChangeText={setDateText}
            placeholder="24/04/2026"
            value={dateText}
          />
          <AppButton iconName="save-outline" onPress={() => void handleSave()} title="Salvar renda" />
          <AppButton onPress={() => setIsAdding(false)} title="Cancelar" variant="ghost" />
        </Card>
      ) : (
        <AppButton iconName="add-outline" onPress={startAdding} title="Adicionar renda" />
      )}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  cycle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
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
    fontWeight: '700',
  },
}));
