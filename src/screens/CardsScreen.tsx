import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import { colors, spacing, typography } from '../design/theme';
import { selectCardInstallments } from '../application/selectors';
import { CreditCardRecord, isLive } from '../application/state';
import { addCycleKeys, cycleKeyFromStartDate } from '../domain/financial/credit-card';
import { RootStackParamList } from '../navigation/types';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '../utils/currency';

type Props = NativeStackScreenProps<RootStackParamList, 'Cards'>;

type CardForm = { id?: string; name: string; closingDay: string; dueDay: string };

const EMPTY_FORM: CardForm = { name: '', closingDay: '', dueDay: '' };

function toDay(value: string): number {
  return Number(value.replace(/\D/g, '')) || 0;
}

function showError(title: string, error: unknown) {
  Alert.alert(title, error instanceof Error ? error.message : 'Tente novamente.');
}

export function CardsScreen({ navigation }: Props) {
  const doc = useFinancialStore((state) => state.doc);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const saveCreditCard = useFinancialStore((state) => state.saveCreditCard);
  const deleteCreditCard = useFinancialStore((state) => state.deleteCreditCard);
  const deleteCardPurchase = useFinancialStore((state) => state.deleteCardPurchase);
  const [form, setForm] = useState<CardForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof CardForm, string>>>({});
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const cards = doc.creditCards.filter(isLive);
  const currentKey = activeMonth ? cycleKeyFromStartDate(activeMonth.startDate) : null;
  const currentInstallments = currentKey ? selectCardInstallments(doc, currentKey) : [];
  const nextInstallments = currentKey ? selectCardInstallments(doc, addCycleKeys(currentKey, 1)) : [];

  function startEditing(card?: CreditCardRecord) {
    setErrors({});
    setForm(
      card
        ? {
            id: card.id,
            name: card.name,
            closingDay: String(card.closingDay),
            dueDay: String(card.dueDay),
          }
        : EMPTY_FORM,
    );
  }

  async function handleSave() {
    if (!form) {
      return;
    }

    const nextErrors: Partial<Record<keyof CardForm, string>> = {};
    const closingDay = toDay(form.closingDay);
    const dueDay = toDay(form.dueDay);

    if (!form.name.trim()) nextErrors.name = 'Informe o nome do cartão.';
    if (closingDay < 1 || closingDay > 28) nextErrors.closingDay = 'Informe um dia entre 1 e 28.';
    if (dueDay < 1 || dueDay > 28) nextErrors.dueDay = 'Informe um dia entre 1 e 28.';

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await saveCreditCard({ id: form.id, name: form.name, closingDay, dueDay });
      setForm(null);
    } catch (error) {
      showError('Não foi possível salvar o cartão', error);
    }
  }

  function handleDeleteCard(card: CreditCardRecord) {
    Alert.alert('Excluir cartão?', `O cartão ${card.name} será removido.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteCreditCard(card.id).catch((error: unknown) => showError('Não foi possível excluir', error));
        },
      },
    ]);
  }

  function handleDeletePurchase(purchaseId: string, description: string) {
    Alert.alert('Excluir compra?', `${description} (todas as parcelas) será removida da fatura.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteCardPurchase(purchaseId).catch((error: unknown) =>
            showError('Não foi possível excluir', error),
          );
        },
      },
    ]);
  }

  return (
    <Screen>
      <Text style={styles.title}>Cartões de crédito</Text>

      {cards.length === 0 && !form ? (
        <EmptyState
          actionLabel="Adicionar cartão"
          iconName="card-outline"
          message="Cadastre o cartão com os dias de fechamento e vencimento para registrar compras no crédito."
          onActionPress={() => startEditing()}
          title="Nenhum cartão"
        />
      ) : null}

      {cards.map((card) => {
        const current = currentInstallments.filter((item) => item.purchase.cardId === card.id);
        const next = nextInstallments.filter((item) => item.purchase.cardId === card.id);
        const currentTotal = current.reduce((total, item) => total + item.amount, 0);
        const nextTotal = next.reduce((total, item) => total + item.amount, 0);
        const isExpanded = expandedCardId === card.id;

        return (
          <Card key={card.id}>
            <Pressable
              accessibilityLabel={`Fatura do cartão ${card.name}`}
              accessibilityRole="button"
              onPress={() => setExpandedCardId(isExpanded ? null : card.id)}
              style={styles.cardHeader}
            >
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardName}>{card.name}</Text>
                <Text style={styles.cardMeta}>
                  Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                </Text>
              </View>
              <Ionicons
                color={colors.muted}
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
              />
            </Pressable>
            {activeMonth ? (
              <>
                <MetricRow label="Fatura deste ciclo" value={formatCurrency(currentTotal)} />
                <MetricRow label="Próximo ciclo" value={formatCurrency(nextTotal)} />
              </>
            ) : null}
            {isExpanded ? (
              <>
                {current.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma parcela neste ciclo.</Text>
                ) : null}
                {current.map((item) => (
                  <View key={item.purchase.id} style={styles.installmentRow}>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.installmentTitle}>{item.purchase.description}</Text>
                      <Text style={styles.cardMeta}>
                        Parcela {item.number}/{item.purchase.installments} ·{' '}
                        {formatCurrency(item.amount)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel={`Excluir compra ${item.purchase.description}`}
                      accessibilityRole="button"
                      onPress={() => handleDeletePurchase(item.purchase.id, item.purchase.description)}
                    >
                      <Ionicons color={colors.critical} name="trash-outline" size={20} />
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}
            <View style={styles.actions}>
              <AppButton
                iconName="create-outline"
                onPress={() => startEditing(card)}
                style={styles.actionButton}
                title="Editar"
                variant="secondary"
              />
              <AppButton
                iconName="trash-outline"
                onPress={() => handleDeleteCard(card)}
                style={styles.actionButton}
                title="Excluir"
                variant="ghost"
              />
            </View>
          </Card>
        );
      })}

      {form ? (
        <Card>
          <Text style={styles.sectionTitle}>{form.id ? 'Editar cartão' : 'Novo cartão'}</Text>
          <TextInputField
            autoCapitalize="words"
            error={errors.name}
            label="Nome do cartão"
            onChangeText={(name) => setForm({ ...form, name })}
            placeholder="Ex: Nubank"
            value={form.name}
          />
          <TextInputField
            error={errors.closingDay}
            keyboardType="number-pad"
            label="Dia de fechamento (1 a 28)"
            maxLength={2}
            onChangeText={(closingDay) => setForm({ ...form, closingDay })}
            value={form.closingDay}
          />
          <TextInputField
            error={errors.dueDay}
            keyboardType="number-pad"
            label="Dia de vencimento (1 a 28)"
            maxLength={2}
            onChangeText={(dueDay) => setForm({ ...form, dueDay })}
            value={form.dueDay}
          />
          <AppButton iconName="save-outline" onPress={() => void handleSave()} title="Salvar cartão" />
          <AppButton onPress={() => setForm(null)} title="Cancelar" variant="ghost" />
        </Card>
      ) : cards.length > 0 ? (
        <AppButton
          iconName="add-outline"
          onPress={() => startEditing()}
          title="Adicionar cartão"
          variant="secondary"
        />
      ) : null}

      <Text style={styles.hint}>
        Compras feitas até o fechamento entram no ciclo desse fechamento; depois dele, na fatura
        seguinte. Parcelas caem uma por ciclo.
      </Text>
      {!activeMonth && cards.length > 0 ? (
        <AppButton
          onPress={() => navigation.navigate('StartMonth')}
          title="Iniciar ciclo para ver faturas"
          variant="ghost"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  installmentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  installmentTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
  },
});
