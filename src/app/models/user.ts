import { Comment } from './client';

export class User {
  uid?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  numberOfClients?: string;
  numberOfCardClients?: string;
  amountInvested?: string;
  amountInvestedDollars?: string;
  moneyInHands?: string;
  investments?: { [key: string]: string } = {};
  investmentsDollar?: { [key: string]: string } = {};
  performances?: { [key: string]: string } = {};
  amountLended?: string;
  clientsSavings?: string;
  expensesAmount?: string;
  expenses?: { [key: string]: string } = {};
  losses?: { [key: string]: string } = {};
  projectedRevenue?: string;
  reserveAmount?: string;
  reserveAmountDollar?: string;
  reserve?: { [key: string]: string } = {};
  reserveinDollar?: { [key: string]: string } = {};
  fees?: string;
  feesData?: { [key: string]: string } = {};
  mode?: string;
  roles?: string[] = ['user'];
  cardsMoney?: string;
  dailyMoneyRequests?: { [key: string]: string } = {};
  totalDebtLeft?: string;
  admin?: string;
  distributor?: string;
  dailyLending?: { [key: string]: string } = {};
  dailySaving?: { [key: string]: string } = {};
  dailySavingReturns?: { [key: string]: string } = {};
  dailyFeesReturns?: { [key: string]: string } = {};
  dailyReimbursement?: { [key: string]: string } = {};
  dailyCardPayments?: { [key: string]: string } = {};
  dailyCardReturns?: { [key: string]: string } = {};
  dailyCardBenefits?: { [key: string]: string } = {};
  monthBudget?: string;
  monthBudgetPending?: string;
  housePayment?: string;
  locationCoordinates?: LocationCoordinates;
  reviews?: Comment[];
  maxNumberOfClients?: string;
}
export class LocationCoordinates {
  longitude?: string;
  lattitude?: string;
}

export type UserDailyField =
  | 'dailyLending'
  | 'dailyReimbursement'
  | 'dailyCardPayments'
  | 'dailyCardReturns'
  | 'dailyCardBenefits'
  | 'dailySaving'
  | 'dailySavingReturns'
  | 'expenses'
  | 'reserve'
  | 'feesData'
  | 'investments'
  | 'dailyMoneyRequests'
  | 'dailyFeesReturns'
  | 'losses';
