export class User {
  uid?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  numberOfClients?: string;
  amountInvested?: string;
  investements?: { [key: string]: string } = {};
  amountLended?: string;
  clientsSavings?: string;
  expensesAmount?: string;
  expenses?: { [key: string]: string } = {};
  projectedRevenue?: string;
  reserveAmount?: string;
  reserve?: { [key: string]: string } = {};
  fees?: string;
}
