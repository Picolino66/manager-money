import { useState } from 'react';
import { Alert, Text } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { MetricRow } from '../components/MetricRow';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import {
  getSortedCategories,
  normalizeCategory,
} from '@manager-money/core/domain/financial/financial.calculations';
import { DEFAULT_EXPENSE_CATEGORY } from '@manager-money/core/domain/financial/financial.types';
import { typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import { useFinancialStore } from '../store/financial.store';

/** Categorias de gasto (Ajustes). A análise por categoria fica em Relatórios (ADR-024). */
export function ManageCategoriesScreen() {
  const styles = useStyles();
  const config = useFinancialStore((state) => state.config);
  const addCategory = useFinancialStore((state) => state.addCategory);
  const categories = getSortedCategories(config);
  const [name, setName] = useState('');

  async function handleCreate() {
    const category = normalizeCategory(name);

    if (category === DEFAULT_EXPENSE_CATEGORY) {
      Alert.alert('Categoria inválida', 'Informe um nome diferente de Outros.');
      return;
    }

    if (categories.includes(category)) {
      Alert.alert('Categoria existente', 'Essa categoria já está cadastrada.');
      return;
    }

    try {
      await addCategory(category);
      setName('');
    } catch (error) {
      Alert.alert(
        'Não foi possível criar a categoria',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.sectionTitle}>Criar categoria</Text>
        <TextInputField
          autoCapitalize="sentences"
          label="Nome"
          onChangeText={setName}
          placeholder="Ex: Viagem"
          value={name}
        />
        <AppButton
          disabled={!config}
          iconName="add-outline"
          onPress={() => void handleCreate()}
          title="Criar categoria"
          variant="secondary"
        />
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>Categorias</Text>
        {categories.map((category) => (
          <MetricRow key={category} label={category} value="" />
        ))}
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
}));
