import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../design/theme';
import { AccountScreen } from '../screens/AccountScreen';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { CardsScreen } from '../screens/CardsScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { ConfigScreen } from '../screens/ConfigScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DailyHistoryScreen } from '../screens/DailyHistoryScreen';
import { IncomesScreen } from '../screens/IncomesScreen';
import { PreviousMonthsScreen } from '../screens/PreviousMonthsScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StartMonthScreen } from '../screens/StartMonthScreen';
import { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
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
                : route.name === 'PreviousMonths'
                  ? 'archive-outline'
                  : route.name === 'Categories'
                    ? 'pie-chart-outline'
                    : 'settings-outline';

          return <Ionicons color={color} name={iconName} size={size} />;
        },
      })}
    >
      <Tab.Screen component={DashboardScreen} name="Dashboard" options={{ title: 'Hoje' }} />
      <Tab.Screen component={DailyHistoryScreen} name="DailyHistory" options={{ title: 'Histórico' }} />
      <Tab.Screen component={PreviousMonthsScreen} name="PreviousMonths" options={{ title: 'Ciclos' }} />
      <Tab.Screen component={CategoriesScreen} name="Categories" options={{ title: 'Categorias' }} />
      <Tab.Screen component={SettingsScreen} name="Settings" options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
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
        <Stack.Screen component={StartMonthScreen} name="StartMonth" options={{ title: 'Iniciar ciclo' }} />
        <Stack.Screen component={AddExpenseScreen} name="AddExpense" options={{ title: 'Registrar gasto' }} />
        <Stack.Screen component={IncomesScreen} name="Incomes" options={{ title: 'Rendas do ciclo' }} />
        <Stack.Screen component={CardsScreen} name="Cards" options={{ title: 'Cartões' }} />
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
