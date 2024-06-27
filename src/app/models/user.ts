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
  totalDebtLeft?: string;
  admin?: string;
  dailyLending?: { [key: string]: string } = {};
  dailySaving?: { [key: string]: string } = {};
  dailyReimbursement?: { [key: string]: string } = {};
  dailyCardPayments?: { [key: string]: string } = {};
  dailyCardReturns?: { [key: string]: string } = {};
  dailyCardBenefits?: { [key: string]: string } = {};
}

export type UserDailyField =
  | 'dailyLending'
  | 'dailyReimbursement'
  | 'dailyCardPayments'
  | 'dailyCardReturns'
  | 'dailyCardBenefits'
  | 'dailySaving'
  | 'expenses'
  | 'reserve'
  | 'feesData'
  | 'investments';
