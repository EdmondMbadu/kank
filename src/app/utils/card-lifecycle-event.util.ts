import {
  Card,
  CardLifecycleEvent,
  CardLifecycleEventType,
} from '../models/card';

export interface CardLifecycleEventValues {
  amount: number;
  cardTotalBefore: number;
  cardTotalAfter: number;
  depositCount?: number;
  returnedAmount?: number;
  returnDate?: string;
  debtLeftAfter?: number;
  occurredDateKey: string;
  createdByUid: string;
  source: string;
}

export function cardReturnableAmount(total: unknown, step: unknown): number {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeStep = Math.max(0, Number(step) || 0);
  return Math.max(0, safeTotal - safeStep);
}

export function countPositiveCardDeposits(
  payments: { [key: string]: string } | null | undefined
): number {
  return Object.values(payments || {}).filter((value) => Number(value) > 0)
    .length;
}

export function buildCardLifecycleEvent(
  card: Card,
  type: CardLifecycleEventType,
  values: CardLifecycleEventValues
): CardLifecycleEvent {
  const amountToPay = Math.max(0, Number(card.amountToPay) || 0);
  const cardTotalBefore = Math.max(0, Number(values.cardTotalBefore) || 0);
  const cardTotalAfter = Math.max(0, Number(values.cardTotalAfter) || 0);
  const nameParts = [card.firstName, card.middleName, card.lastName]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return {
    type,
    amount: Math.max(0, Math.abs(Number(values.amount) || 0)),
    amountToPay,
    cardTotalBefore,
    cardTotalAfter,
    returnableBefore: cardReturnableAmount(cardTotalBefore, amountToPay),
    returnableAfter: cardReturnableAmount(cardTotalAfter, amountToPay),
    depositCount: Math.max(0, Math.floor(Number(values.depositCount) || 0)),
    cycle: Math.max(1, Math.floor(Number(card.cardCycle) || 1)),
    firstName: String(card.firstName || '').trim(),
    middleName: String(card.middleName || '').trim(),
    lastName: String(card.lastName || '').trim(),
    fullName: nameParts.join(' ') || 'Client',
    phoneNumber: String(card.phoneNumber || '').trim(),
    ...(values.returnDate ? { returnDate: values.returnDate } : {}),
    ...(values.returnedAmount !== undefined
      ? { returnedAmount: Math.max(0, Number(values.returnedAmount) || 0) }
      : {}),
    ...(values.debtLeftAfter !== undefined
      ? { debtLeftAfter: Math.max(0, Number(values.debtLeftAfter) || 0) }
      : {}),
    occurredAtMs: Date.now(),
    occurredDateKey: values.occurredDateKey,
    createdByUid: values.createdByUid,
    source: values.source,
  };
}
