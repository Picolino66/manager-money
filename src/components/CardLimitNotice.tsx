import { Alert, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../design/theme';
import { CardLimitUsage } from '../domain/financial/credit-card';
import { MoneyCents } from '../domain/financial/financial.types';
import { formatCurrency } from '../utils/currency';

/** BR-FIN-026: a compra passa do limite disponível (só aviso, nunca bloqueia). */
export function exceedsCardLimit(usage: CardLimitUsage | null, amount: MoneyCents): boolean {
  return usage !== null && usage.available !== null && amount > usage.available;
}

/**
 * Pede confirmação quando a compra passa do limite disponível do cartão. Resolve `true` se não
 * passar ou se a pessoa escolher continuar (decisão do dono: avisar e permitir).
 */
export function confirmCardLimit(
  usage: CardLimitUsage | null,
  amount: MoneyCents,
): Promise<boolean> {
  const available = usage?.available ?? null;

  if (available === null || amount <= available) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Passa do limite do cartão',
      `Esta compra de ${formatCurrency(amount)} passa do limite disponível do cartão ` +
        `(${formatCurrency(available)}). Continuar mesmo assim?`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuar', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

type CardLimitNoticeProps = {
  usage: CardLimitUsage | null;
  /** Valor da compra em análise (0 = ainda não informado). */
  amount: MoneyCents;
};

/**
 * Mostra o limite disponível do cartão escolhido. Deixa claro que limite não é dinheiro para gastar:
 * o que pode gastar é o "Ainda pode gastar hoje" da tela Hoje.
 */
export function CardLimitNotice({ usage, amount }: CardLimitNoticeProps) {
  const exceeds = exceedsCardLimit(usage, amount);

  return (
    <View style={[styles.box, exceeds && styles.boxWarning]}>
      <Text style={styles.label}>
        {usage?.available === null || usage?.available === undefined
          ? 'Limite do cartão não informado'
          : `Limite disponível do cartão: ${formatCurrency(usage.available)}`}
      </Text>
      {exceeds ? (
        <Text style={styles.warning}>Esta compra passa do limite disponível do cartão.</Text>
      ) : null}
      <Text style={styles.hint}>
        Limite do cartão não é dinheiro para gastar: a compra pesa no ciclo em que a fatura vence.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.info,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  boxWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  warning: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '800',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
});
