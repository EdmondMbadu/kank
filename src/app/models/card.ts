import { ClientGalleryPicture } from './client';

export interface CardTotalWithdrawalSnapshot {
  amountPaid?: string;
  numberOfPaymentsMade?: string;
  depositCount?: string;
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

export type CardLifecycleEventType =
  | 'card_created'
  | 'cycle_started'
  | 'deposit'
  | 'partial_withdrawal'
  | 'withdrawal_requested'
  | 'total_withdrawal'
  | 'credit_transfer'
  | 'total_withdrawal_reversed'
  | 'manual_correction';

export interface CardLifecycleEvent {
  type: CardLifecycleEventType;
  amount: number;
  amountToPay: number;
  cardTotalBefore: number;
  cardTotalAfter: number;
  returnableBefore: number;
  returnableAfter: number;
  depositCount: number;
  cycle: number;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string;
  returnDate?: string;
  returnedAmount?: number;
  debtLeftAfter?: number;
  occurredAtMs: number;
  occurredDateKey: string;
  createdByUid: string;
  source: string;
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
  depositCount?: string;
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
  galleryPictures?: { [key: string]: ClientGalleryPicture } = {};
  totalWithdrawalSnapshot?: CardTotalWithdrawalSnapshot;
}
