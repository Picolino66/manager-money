import { Pressable, ScrollView, Text, View } from 'react-native';

import { radius, spacing } from '../design/theme';
import { makeStyles } from '../design/useTheme';

type CategoryPickerProps = {
  label: string;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
};

export function CategoryPicker({
  label,
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryPickerProps) {
  const styles = useStyles();
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.options}>
          {categories.map((category) => {
            const isSelected = category === selectedCategory;

            return (
              <Pressable
                accessibilityRole="button"
                key={category}
                onPress={() => onSelectCategory(category)}
                style={[styles.option, isSelected ? styles.optionSelected : null]}
              >
                <Text style={[styles.optionText, isSelected ? styles.optionTextSelected : null]}>
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  options: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  option: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: colors.primaryDark,
  },
}));
