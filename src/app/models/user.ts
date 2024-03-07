export class User {
  uid?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  numberOfClients?: string;
  numberOfCardClients?: string;
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
  reserveAmountDollar?: string;
  reserve?: { [key: string]: string } = {};
  fees?: string;
  cardsMoney?: string;
  totalDebtLeft?: string;
  dailyLending?: { [key: string]: string } = {};
  dailyReimbursement?: { [key: string]: string } = {};
  dailyCardPayments?: { [key: string]: string } = {};
  dailyCardReturns?: { [key: string]: string } = {};
  dailyCardBenefits?: { [key: string]: string } = {};
}
