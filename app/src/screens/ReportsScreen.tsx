import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { radius, spacing, typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import { MainTabParamList } from '../navigation/types';
import { useFinancialStore } from '../store/financial.store';
import { CategoriesReport } from './reports/CategoriesReport';
import { CreditReport } from './reports/CreditReport';
import { CyclesReport } from './reports/CyclesReport';

type Props = BottomTabScreenProps<MainTabParamList, 'Reports'>;

type Section = 'cycles' | 'categories' | 'credit';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'cycles', label: 'Ciclos' },
  { value: 'categories', label: 'Categorias' },
  { value: 'credit', label: 'Crédito' },
];

/**
 * Relatórios (ADR-024): olhar para trás. Ciclos (ciclo do salário), Categorias (para onde foi o
 * dinheiro) e Crédito (faturas pelo ciclo do cartão). A lista do dia a dia fica no Histórico.
 */
export function ReportsScreen({ navigation }: Props) {
  const styles = useStyles();
  const config = useFinancialStore((state) => state.config);
  const [section, setSection] = useState<Section>('cycles');

  if (!config) {
    return (
      <Screen refreshable>
        <EmptyState
          actionLabel="Configurar"
          iconName="settings-outline"
          message="Configure a base financeira antes de ver os relatórios."
          onActionPress={() => navigation.navigate('Dashboard')}
          title="Configuração pendente"
        />
      </Screen>
    );
  }

  return (
    <Screen refreshable>
      <Text style={styles.title}>Relatórios</Text>
      <View accessibilityLabel="Relatório" accessibilityRole="radiogroup" style={styles.group}>
        {SECTIONS.map((option) => {
          const selected = option.value === section;

          return (
            <Pressable
              accessibilityLabel={`Relatório ${option.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => setSection(option.value)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {section === 'cycles' ? <CyclesReport /> : null}
      {section === 'categories' ? <CategoriesReport /> : null}
      {section === 'credit' ? <CreditReport /> : null}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  group: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  option: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  optionSelected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  labelSelected: {
    color: colors.ink,
  },
}));
