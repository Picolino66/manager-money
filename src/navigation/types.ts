import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Config: undefined;
  StartMonth: undefined;
  AddExpense: {
    expenseId?: string;
  } | undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  DailyHistory: undefined;
  PreviousMonths: undefined;
  Categories: undefined;
};
