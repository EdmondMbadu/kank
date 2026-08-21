import { Card } from '../models/card';
import {
  buildCardLifecycleEvent,
  cardReturnableAmount,
  countPositiveCardDeposits,
} from './card-lifecycle-event.util';

describe('card lifecycle event utilities', () => {
  it('separates the card total from the returnable amount', () => {
    expect(cardReturnableAmount(50000, 50000)).toBe(0);
    expect(cardReturnableAmount(100000, 50000)).toBe(50000);
  });

  it('counts deposits without counting withdrawals', () => {
    expect(
      countPositiveCardDeposits({ first: '50000', second: '-50000', third: '50000' })
    ).toBe(2);
  });

  it('captures immutable before and after values', () => {
    const event = buildCardLifecycleEvent(
      {
        firstName: 'Jensen',
        middleName: 'Jeffrey',
        lastName: 'Kabi',
        phoneNumber: '2156877614',
        amountToPay: '50000',
        cardCycle: '1',
      } as Card,
      'deposit',
      {
        amount: 50000,
        cardTotalBefore: 50000,
        cardTotalAfter: 100000,
        depositCount: 2,
        occurredDateKey: '8-20-2026-10-0-0',
        createdByUid: 'owner-1',
        source: 'payment-card',
      }
    );

    expect(event.fullName).toBe('Jensen Jeffrey Kabi');
    expect(event.returnableBefore).toBe(0);
    expect(event.returnableAfter).toBe(50000);
    expect(event.depositCount).toBe(2);
  });
});
