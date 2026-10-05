import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../design/useTheme';
import { AccountScreen } from '../screens/AccountScreen';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { CardDebtScreen } from '../screens/CardDebtScreen';
import { CardDetailScreen } from '../screens/CardDetailScreen';
import { CardsScreen } from '../screens/CardsScreen';
import { ConfigScreen } from '../screens/ConfigScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DailyHistoryScreen } from '../screens/DailyHistoryScreen';
import { IncomesScreen } from '../screens/IncomesScreen';
import { ManageCategoriesScreen } from '../screens/ManageCategoriesScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StartMonthScreen } from '../screens/StartMonthScreen';
import { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === 'Dashboard'
              ? 'home-outline'
              : route.name === 'DailyHistory'
                ? 'calendar-outline'
                : route.name === 'Cards'
                  ? 'card-outline'
                  : route.name === 'Reports'
                    ? 'pie-chart-outline'
                    : 'settings-outline';

          return <Ionicons color={color} name={iconName} size={size} />;
        },
      })}
    >
      <Tab.Screen component={DashboardScreen} name="Dashboard" options={{ title: 'Hoje' }} />
      <Tab.Screen
        component={DailyHistoryScreen}
        name="DailyHistory"
        options={{ title: 'Histórico' }}
      />
      <Tab.Screen component={CardsScreen} name="Cards" options={{ title: 'Cartões' }} />
      <Tab.Screen component={ReportsScreen} name="Reports" options={{ title: 'Relatórios' }} />
      <Tab.Screen component={SettingsScreen} name="Settings" options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { colors, scheme } = useTheme();
  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme: Theme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.ink,
      border: colors.border,
      notification: colors.critical,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen component={MainTabs} name="MainTabs" options={{ headerShown: false }} />
        <Stack.Screen component={ConfigScreen} name="Config" options={{ title: 'Configuração' }} />
        <Stack.Screen
          component={StartMonthScreen}
          name="StartMonth"
          options={{ title: 'Iniciar ciclo' }}
        />
        <Stack.Screen
          component={AddExpenseScreen}
          name="AddExpense"
          options={{ title: 'Registrar gasto' }}
        />
        <Stack.Screen
          component={IncomesScreen}
          name="Incomes"
          options={{ title: 'Rendas do ciclo' }}
        />
        <Stack.Screen
          component={CardDetailScreen}
          name="CardDetail"
          options={{ title: 'Cartão' }}
        />
        <Stack.Screen
          component={CardDebtScreen}
          name="CardDebt"
          options={{ title: 'Compras anteriores ao app' }}
        />
        <Stack.Screen
          component={ManageCategoriesScreen}
          name="ManageCategories"
          options={{ title: 'Categorias' }}
        />
        <Stack.Screen component={AccountScreen} name="Account" options={{ title: 'Conta' }} />
        <Stack.Screen
          component={PrivacyPolicyScreen}
          name="PrivacyPolicy"
          options={{ title: 'Política de privacidade' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
