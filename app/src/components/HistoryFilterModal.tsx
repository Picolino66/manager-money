import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';

import {
  EMPTY_PAID_HISTORY_FILTER,
  PAID_HISTORY_LABELS,
  PaidHistoryFilter,
  PaidHistoryType,
} from '@manager-money/core/application/paid-history';
import { formatDateInput, parseBRDateInput, toISODate } from '@manager-money/core/utils/date';
import { radius, spacing, typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import { AppButton } from './AppButton';
import { SelectField } from './SelectField';
import { TextInputField } from './TextInputField';

type HistoryFilterModalProps = {
  filter: PaidHistoryFilter;
  categories: string[];
  onApply: (filter: PaidHistoryFilter) => void;
  onClose: () => void;
};

type Errors = Partial<Record<'from' | 'to', string>>;

const ALL = '';

/**
 * Filtros do histórico, os mesmos do client web: busca, categoria, tipo e período (o app só mostra
 * o ciclo ativo, então não há filtro de ciclo). Datas em branco = sem limite.
 */
export function HistoryFilterModal({
  filter,
  categories,
  onApply,
  onClose,
}: HistoryFilterModalProps) {
  const styles = useStyles();
  const [search, setSearch] = useState(filter.search);
  const [category, setCategory] = useState(filter.category ?? ALL);
  const [type, setType] = useState<string>(filter.type ?? ALL);
  const [fromText, setFromText] = useState(filter.from ? formatDateInput(filter.from) : '');
  const [toText, setToText] = useState(filter.to ? formatDateInput(filter.to) : '');
  const [errors, setErrors] = useState<Errors>({});
  const categoryOptions = [
    { label: 'Todas', value: ALL },
    ...categories.map((value) => ({ label: value, value })),
  ];
  const typeOptions = [
    { label: 'Todos', value: ALL },
    ...(Object.keys(PAID_HISTORY_LABELS) as PaidHistoryType[]).map((value) => ({
      label: PAID_HISTORY_LABELS[value],
      value,
    })),
  ];

  function readDate(text: string): string | null | undefined {
    if (!text.trim()) return '';
    const date = parseBRDateInput(text);

    return date ? toISODate(date) : undefined;
  }

  function handleApply() {
    const from = readDate(fromText);
    const to = readDate(toText);
    const nextErrors: Errors = {};

    if (from === undefined) nextErrors.from = 'Use o formato DD/MM/AAAA.';
    if (to === undefined) nextErrors.to = 'Use o formato DD/MM/AAAA.';
    if (from && to && from > to) nextErrors.to = 'A data final vem antes da inicial.';

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || from === undefined || to === undefined) return;

    onApply({
      ...EMPTY_PAID_HISTORY_FILTER,
      search: search.trim(),
      category: category || null,
      type: (type || null) as PaidHistoryType | null,
      from: from ?? '',
      to: to ?? '',
    });
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Filtros do histórico</Text>
            <TextInputField
              label="Buscar"
              onChangeText={setSearch}
              placeholder="Descrição ou categoria"
              value={search}
            />
            <SelectField
              label="Categoria"
              onChange={setCategory}
              options={categoryOptions}
              value={category}
            />
            <SelectField label="Tipo" onChange={setType} options={typeOptions} value={type} />
            <TextInputField
              error={errors.from}
              keyboardType="number-pad"
              label="De"
              maxLength={10}
              onChangeText={setFromText}
              placeholder="DD/MM/AAAA"
              value={fromText}
            />
            <TextInputField
              error={errors.to}
              keyboardType="number-pad"
              label="Até"
              maxLength={10}
              onChangeText={setToText}
              placeholder="DD/MM/AAAA"
              value={toText}
            />
            <AppButton iconName="funnel-outline" onPress={handleApply} title="Aplicar filtros" />
            <AppButton
              onPress={() => onApply(EMPTY_PAID_HISTORY_FILTER)}
              title="Limpar filtros"
              variant="secondary"
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
}));
