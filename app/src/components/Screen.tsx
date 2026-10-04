import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  ViewStyle,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';
import { useSyncRefresh } from './useSyncRefresh';

type ScreenProps = PropsWithChildren<{
  contentContainerStyle?: ViewStyle;
  footer?: ReactNode;
  /** Puxar para atualizar: sincroniza com o banco (só com a conta conectada). */
  refreshable?: boolean;
}>;

export function Screen({ children, contentContainerStyle, footer, refreshable }: ScreenProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const refresh = useSyncRefresh();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const bottomInset = Math.max(insets.bottom, spacing.xl);
  const footerOffset = footer ? 88 + bottomInset : 0;

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: spacing.xxl + bottomInset + keyboardHeight + footerOffset,
            paddingTop: spacing.xl + insets.top,
          },
          contentContainerStyle,
        ]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          refreshable && refresh ? (
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={refresh.onRefresh}
              refreshing={refresh.refreshing}
              tintColor={colors.primary}
            />
          ) : undefined
        }
        style={styles.container}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: bottomInset }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  footer: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
}));
