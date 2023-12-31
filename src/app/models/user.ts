export class User {
  uid?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  numberOfClients?: string;
  amountInvested?: string;
  moneyInHands?: string;
  investments?: { [key: string]: string } = {};
  performances?: { [key: string]: string } = {};
  amountLended?: string;
  clientsSavings?: string;
  expensesAmount?: string;
  expenses?: { [key: string]: string } = {};
  projectedRevenue?: string;
  reserveAmount?: string;
  reserve?: { [key: string]: string } = {};
  fees?: string;
  totalDebtLeft?: string;
  dailyLending?: { [key: string]: string } = {};
  dailyReimbursement?: { [key: string]: string } = {};
}
