export class Client {
  uid?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  profession?: string;
  phoneNumber?: string;
  businessCapital?: string;
  homeAddress?: string;
  businessAddress?: string;
  debtCycle?: string;
  membershipFee?: string;
  applicationFee?: string;
  savings?: string;
  loanAmount?: string;
  creditScore?: string;
  amountPaid?: string;
  dateJoined?: string;
  numberOfPaymentsMissed?: string;
  numberOfPaymentsMade?: string;
  payments?: { [key: string]: string } = {};
  savingsPayments?: { [key: string]: string } = {};
}
