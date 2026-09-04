import { Card, CardLifecycleEvent } from '../models/card';
import {
  buildCardPaymentActivities,
  buildCompletedCardCycleSummaries,
} from './card-payment-activity.util';

function lifecycleEvent(
  values: Partial<CardLifecycleEvent>
): CardLifecycleEvent {
  return {
    type: 'deposit',
    amount: 1000,
    amountToPay: 1000,
    cardTotalBefore: 0,
    cardTotalAfter: 1000,
    returnableBefore: 0,
    returnableAfter: 0,
    depositCount: 1,
    cycle: 1,
    firstName: 'Test',
    middleName: '',
    lastName: 'Client',
    fullName: 'Test Client',
    phoneNumber: '',
    occurredAtMs: 1,
    occurredDateKey: '9-1-2026-10-0-0',
    createdByUid: 'owner-1',
    source: 'test',
    ...values,
  };
}

describe('buildCardPaymentActivities', () => {
  it('keeps deposits and partial withdrawals in newest-first order', () => {
    const card: Card = {
      payments: {
        '9-1-2026-10-0-0': '1000',
        '9-2-2026-10-0-0': '2000',
        '9-3-2026-10-0-0': '-1500',
      },
    };

    const result = buildCardPaymentActivities(card);

    expect(result.map((activity) => activity.kind)).toEqual([
      'partial_withdrawal',
      'deposit',
      'deposit',
    ]);
    expect(result.map((activity) => activity.amount)).toEqual([
      1500, 2000, 1000,
    ]);
  });

  it('recovers deposits from the pre-withdrawal snapshot', () => {
    const card: Card = {
      payments: {},
      withdrawal: { '9-3-2026-12-0-0': '2500' },
      totalWithdrawalSnapshot: {
        payments: {
          '9-1-2026-10-0-0': '1000',
          '9-2-2026-10-0-0': '2500',
        },
      },
    };

    const result = buildCardPaymentActivities(card);

    expect(result.map(({ kind, amount }) => ({ kind, amount }))).toEqual([
      { kind: 'total_withdrawal', amount: 2500 },
      { kind: 'deposit', amount: 2500 },
      { kind: 'deposit', amount: 1000 },
    ]);
  });

  it('merges lifecycle events without duplicating matching card entries', () => {
    const dateKey = '9-2-2026-10-0-0';
    const card: Card = { payments: { [dateKey]: '2000' } };
    const result = buildCardPaymentActivities(card, [
      {
        ...lifecycleEvent({ amount: 2000, occurredDateKey: dateKey }),
        uid: 'event-1',
      },
      {
        ...lifecycleEvent({
          type: 'partial_withdrawal',
          amount: 500,
          occurredDateKey: '9-3-2026-10-0-0',
          occurredAtMs: 2,
        }),
        uid: 'event-2',
      },
    ]);

    expect(result.length).toBe(2);
    expect(result[1].eventId).toBe('event-1');
    expect(result[1].paymentDateKey).toBe(dateKey);
  });

  it('assigns repeated full withdrawals to separate completed cycles', () => {
    const card: Card = {
      cardCycle: '4',
      clientCardStatus: '',
      withdrawal: {
        '3-5-2024-16-0-0': '200000',
        '4-28-2024-7-19-0': '100000',
        '3-11-2026-14-22-0': '150000',
      },
    };

    const summaries = buildCompletedCardCycleSummaries(card);

    expect(summaries.map(({ cycle, amount }) => ({ cycle, amount }))).toEqual([
      { cycle: 3, amount: 150000 },
      { cycle: 2, amount: 100000 },
      { cycle: 1, amount: 200000 },
    ]);
  });
});
