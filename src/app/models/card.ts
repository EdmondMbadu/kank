export interface CardTotalWithdrawalSnapshot {
  amountPaid?: string;
  numberOfPaymentsMade?: string;
  payments?: { [key: string]: string };
  withdrawal?: { [key: string]: string };
  clientCardStatus?: string;
  requestAmount?: string;
  requestStatus?: string;
  requestType?: string;
  requestDate?: string;
  dateOfRequest?: string;
  returnedAmount?: string;
  returnDayKey?: string;
  capturedAt?: string;
}

export class Card {
  uid?: string;
  name?: string;
  firstName?: string;
  trackingId?: string;
  lastName?: string;
  middleName?: string;
  profession?: string;
  phoneNumber?: string;
  homeAddress?: string;
  businessAddress?: string;
  amountPaid?: string;
  dateJoined?: string;
  cardCycle?: string;
  clientMoney?: string;
  numberOfPaymentsMade?: string;
  payments?: { [key: string]: string } = {};
  withdrawal?: { [key: string]: string } = {};
  amountToPay?: string;
  requestAmount?: string;
  requestStatus?: string;
  requestDate?: string;
  requestType?: string;
  dateOfRequest?: string;
  amountPaidToday?: string;
  paymentPeriodRange?: string;
  cardCycleStartDate?: string;
  clientCardStatus?: string;
  cardCycleEndDate?: string;
  totalWithdrawalSnapshot?: CardTotalWithdrawalSnapshot;
}
