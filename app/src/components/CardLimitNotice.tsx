import { Alert, Text, View } from 'react-native';

import { radius, spacing } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import { calculateLimitExcess, CardLimitUsage } from '../domain/financial/credit-card';
import { MoneyCents } from '../domain/financial/financial.types';
import { formatCurrency } from '../utils/currency';

/** BR-FIN-026: a compra passa do limite disponível (só aviso, nunca bloqueia). */
export function exceedsCardLimit(usage: CardLimitUsage | null, amount: MoneyCents): boolean {
  return usage !== null && usage.available !== null && amount > usage.available;
}

/** Texto do alerta de compra acima do limite disponível cadastrado (BR-FIN-026). */
export function describeLimitExcess(excess: MoneyCents): string {
  return (
    `Esta compra excede em ${formatCurrency(excess)} o limite disponível cadastrado deste cartão. ` +
    'O banco pode ter autorizado um limite diferente. Deseja registrar mesmo assim?'
  );
}

/**
 * Pede confirmação quando a compra passa do limite disponível do cartão. Resolve `true` se não
 * passar ou se a pessoa escolher registrar mesmo assim (decisão do dono: avisar e permitir).
 */
export function confirmCardLimit(
  usage: CardLimitUsage | null,
  amount: MoneyCents,
): Promise<boolean> {
  const excess = calculateLimitExcess(usage?.available ?? null, amount);

  if (excess <= 0) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Passa do limite do cartão',
      describeLimitExcess(excess),
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Registrar mesmo assim', onPress: () => resolve(true) },
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
  const styles = useStyles();
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

const useStyles = makeStyles((colors) => ({
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
}));
