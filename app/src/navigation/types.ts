import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Config: undefined;
  StartMonth: undefined;
  AddExpense:
    | {
        expenseId?: string;
      }
    | undefined;
  CardDetail: {
    cardId: string;
  };
  CardDebt: {
    cardId: string;
  };
  Incomes: undefined;
  ManageCategories: undefined;
  Account: undefined;
  PrivacyPolicy: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  DailyHistory: undefined;
  Cards: undefined;
  Reports: undefined;
  Settings: undefined;
};
