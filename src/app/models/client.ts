import { Avatar, Employee } from './employee';

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
  membershipFeePayments?: { [key: string]: string } = {};
  applicationFee?: string;
  applicationFeePayments?: { [key: string]: string } = {};
  savings?: string;
  loanAmount?: string;
  creditScore?: string;
  amountPaid?: string;
  debtLeft?: string;
  dateJoined?: string;
  numberOfPaymentsMissed?: string;
  numberOfPaymentsMade?: string;
  payments?: { [key: string]: string } = {};
  previousPayments?: { [key: string]: string } = {};
  previousSavingsPayments?: { [key: string]: string } = {};
  savingsPayments?: { [key: string]: string } = {};
  interestRate?: string;
  agent?: string;
  amountToPay?: string;
  loanAmountPending?: string;
  paymentPeriodRange?: string;
  debtCycleStartDate?: string;
  debtCycleEndDate?: string;
  employee?: Employee;
  type?: string;
  requestAmount?: string;
  previouslyRequestedAmount?: string;
  requestStatus?: string;
  requestDate?: string;
  requestType?: string;
  rejectionReturnAmount?: string; // NEW
  dateOfRequest?: string;
  profilePicture?: Avatar;
  vitalStatus?: string;
  timeInBusiness?: string;
  monthlyIncome?: string;
  debtInProcess?: string;
  planToPayDebt?: string;
  references?: string[];
  collateral?: string;
  creditworthinessScore?: string;
  cycleId?: string;
  comments?: Comment[];
  isPhoneCorrect?: string;
  agentVerifyingName?: string;
  agentSubmittedVerification?: string;
  birthDate?: string;
  age?: string;
}

export class Comment {
  name?: string;
  time?: string;
  timeFormatted?: string;
  comment?: string;
  stars?: string;
  starsNumber?: number;
  audioUrl?: string;
}
