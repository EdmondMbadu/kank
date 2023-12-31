import { Employee } from './employee';

export class Client {
  uid?: string;
  trackingId?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  profession?: string;
  phoneNumber?: string;
  paymentDay?: string;
  minPayment?: string;
  frenchPaymentDay?: string;
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
  debtLeft?: string;
  dateJoined?: string;
  numberOfPaymentsMissed?: string;
  numberOfPaymentsMade?: string;
  payments?: { [key: string]: string } = {};
  savingsPayments?: { [key: string]: string } = {};
  interestRate?: string;
  agent?: string;
  amountToPay?: string;
  paymentPeriodRange?: string;
  debtCycleStartDate?: string;
  debtCycleEndDate?: string;
  employee?: Employee;
}
