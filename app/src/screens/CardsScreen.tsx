import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CreditCardInput } from '@manager-money/core/application/card.use-cases';
import {
  selectCardLimitUsage,
  selectCardStatements,
  selectCreditCards,
} from '@manager-money/core/application/selectors';
import { CreditCardRecord } from '@manager-money/core/application/state';
import { AppButton } from '../components/AppButton';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { CardForm } from '../components/CardForm';
import { CardLimitBar } from '../components/CardLimitBar';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { Screen } from '../components/Screen';
import { spacing, typography } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';
import { isActive } from '@manager-money/core/domain/financial/financial.types';
import { RootStackParamList } from '../navigation/types';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { CARD_LIMIT_DISCLAIMER, STATEMENT_STATUS_LABEL } from '@manager-money/core/application/card-text';
import { buildCardStatementsView, formatDayMonth, hasCardPurchases } from '@manager-money/core/application/card-view';

type Props = NativeStackScreenProps<RootStackParamList, 'Cards'>;

/** `null` = formulário fechado; `'new'` = novo cartão; senão, o id do cartão em edição. */
type FormTarget = null | 'new' | string;

function showError(title: string, error: unknown) {
  Alert.alert(title, error instanceof Error ? error.message : 'Tente novamente.');
}

/** SPEC-016/017: lista de cartões com limite disponível do cartão, fatura atual e estado. */
export function CardsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const doc = useFinancialStore((state) => state.doc);
  const saveCreditCard = useFinancialStore((state) => state.saveCreditCard);
  const deleteCreditCard = useFinancialStore((state) => state.deleteCreditCard);
  const setCreditCardActive = useFinancialStore((state) => state.setCreditCardActive);
  const activeCycleId = useFinancialStore((state) => state.activeMonth?.id ?? null);
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [createdCard, setCreatedCard] = useState<CreditCardRecord | null>(null);
  const cards = selectCreditCards(doc);
  const editingCard =
    formTarget && formTarget !== 'new' ? cards.find((card) => card.id === formTarget) : undefined;

  function openForm(target: FormTarget) {
    setCreatedCard(null);
    setFormTarget(target);
  }

  async function handleSubmit(input: CreditCardInput) {
    try {
      await saveCreditCard(input);
      setFormTarget(null);

      if (!input.id) {
        const name = input.name.trim().toLowerCase();
        const saved = selectCreditCards(useFinancialStore.getState().doc).find(
          (card) => card.name.toLowerCase() === name,
        );
        setCreatedCard(saved ?? null);
      }
    } catch (error) {
      showError('Não foi possível salvar o cartão', error);
    }
  }

  function handleToggleActive(card: CreditCardRecord) {
    setCreditCardActive(card.id, !isActive(card)).catch((error: unknown) =>
      showError('Não foi possível atualizar o cartão', error),
    );
  }

  function handleDeleteCard(card: CreditCardRecord) {
    Alert.alert('Excluir cartão?', `O cartão ${card.name} será removido.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteCreditCard(card.id).catch((error: unknown) =>
            showError('Não foi possível excluir', error),
          );
        },
      },
    ]);
  }

  const today = new Date();

  return (
    <Screen>
      <Text style={styles.title}>Cartões de crédito</Text>

      {cards.length === 0 && !formTarget ? (
        <EmptyState
          actionLabel="Adicionar cartão"
          iconName="card-outline"
          message="Cadastre o cartão com os dias de fechamento e vencimento para registrar compras no crédito."
          onActionPress={() => openForm('new')}
          title="Nenhum cartão"
        />
      ) : null}

      {createdCard ? (
        <Card style={styles.prompt}>
          <Text style={styles.promptTitle}>Cartão {createdCard.name} cadastrado</Text>
          <Text style={styles.hint}>
            Ele já tem fatura em aberto ou parcelamentos de antes do app? Cadastre agora para o
            limite e os próximos ciclos ficarem certos.
          </Text>
          <AppButton
            iconName="time-outline"
            onPress={() => {
              setCreatedCard(null);
              navigation.navigate('CardDebt', { cardId: createdCard.id });
            }}
            title="Cadastrar compras anteriores"
          />
          <AppButton onPress={() => setCreatedCard(null)} title="Agora não" variant="ghost" />
        </Card>
      ) : null}

      {cards.map((card) => {
        const usage = selectCardLimitUsage(doc, card.id);
        const { current } = buildCardStatementsView(
          card,
          selectCardStatements(doc, card.id, today),
          today,
          activeCycleId,
        );
        const active = isActive(card);
        const withPurchases = hasCardPurchases(doc, card.id);

        return (
          <Card key={card.id}>
            <Pressable
              accessibilityHint="Abre faturas, limite e compras do cartão"
              accessibilityLabel={`Abrir cartão ${card.name}`}
              accessibilityRole="button"
              onPress={() => navigation.navigate('CardDetail', { cardId: card.id })}
              style={styles.cardHeader}
            >
              <View style={styles.cardHeaderText}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardName}>{card.name}</Text>
                  {!active ? <Badge label="Inativo" /> : null}
                </View>
                <Text style={styles.cardMeta}>
                  Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                </Text>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward-outline" size={20} />
            </Pressable>

            {usage && usage.available !== null ? (
              <>
                <MetricRow
                  label="Limite disponível do cartão"
                  tone={usage.available < 0 ? 'negative' : 'default'}
                  value={formatCurrency(usage.available)}
                />
                <CardLimitBar committed={usage.committed} creditLimit={usage.creditLimit} />
              </>
            ) : (
              <MetricRow label="Limite disponível do cartão" value="Limite não informado" />
            )}
            <MetricRow
              label={`Fatura atual (${STATEMENT_STATUS_LABEL[current.status].toLowerCase()}${current.status === 'partial' ? ', restante' : ''}) · vence ${formatDayMonth(current.dueDate)}`}
              value={formatCurrency(current.status === 'open' ? current.amount : current.remaining)}
            />

            <View style={styles.actions}>
              <AppButton
                accessibilityLabel={`Editar cartão ${card.name}`}
                iconName="create-outline"
                onPress={() => openForm(card.id)}
                style={styles.actionButton}
                title="Editar"
                variant="secondary"
              />
              <AppButton
                accessibilityLabel={`${active ? 'Desativar' : 'Ativar'} cartão ${card.name}`}
                iconName={active ? 'pause-circle-outline' : 'play-circle-outline'}
                onPress={() => handleToggleActive(card)}
                style={styles.actionButton}
                title={active ? 'Desativar' : 'Ativar'}
                variant="secondary"
              />
              {!withPurchases ? (
                <AppButton
                  accessibilityLabel={`Excluir cartão ${card.name}`}
                  iconName="trash-outline"
                  onPress={() => handleDeleteCard(card)}
                  style={styles.actionButton}
                  title="Excluir"
                  variant="ghost"
                />
              ) : null}
            </View>
            {withPurchases ? (
              <Text style={styles.hint}>
                Cartão com compras não pode ser excluído. Desative para tirá-lo das novas compras;
                as parcelas continuam valendo.
              </Text>
            ) : null}
          </Card>
        );
      })}

      {formTarget ? (
        <CardForm
          card={editingCard}
          key={formTarget}
          onCancel={() => setFormTarget(null)}
          onSubmit={handleSubmit}
        />
      ) : cards.length > 0 ? (
        <AppButton
          iconName="add-outline"
          onPress={() => openForm('new')}
          title="Adicionar cartão"
          variant="secondary"
        />
      ) : null}

      {cards.length > 0 ? <Text style={styles.hint}>{CARD_LIMIT_DISCLAIMER}</Text> : null}
      <Text style={styles.hint}>
        A compra entra na fatura do próximo fechamento e pesa no ciclo em que a fatura vence. O
        limite só é liberado quando você marca &quot;Paguei a fatura&quot;.
      </Text>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  prompt: {
    borderColor: colors.primary,
  },
  promptTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    flexGrow: 1,
    minHeight: 44,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
  },
}));
