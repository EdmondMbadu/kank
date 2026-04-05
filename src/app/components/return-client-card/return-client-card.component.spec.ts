import { ReturnClientCardComponent } from './return-client-card.component';

describe('ReturnClientCardComponent', () => {
  const time = {
    todaysDate: () => '4-5-2026-10-11-12',
    todaysDateMonthDayYear: () => '4-5-2026',
  };

  const buildComponent = () =>
    new ReturnClientCardComponent(
      { snapshot: { paramMap: { get: () => '0' } } } as any,
      { currentUser: {} } as any,
      {} as any,
      {} as any,
      time as any,
      {} as any,
      {} as any
    );

  it('captures the full pre-withdraw state before ending the card cycle', () => {
    const component = buildComponent();
    component.amountToReturnToClient = '9000';
    component.clientCard = {
      amountPaid: '12000',
      numberOfPaymentsMade: '6',
      payments: { oldPayment: '2000' },
      withdrawal: { previousWithdrawal: '500' },
      clientCardStatus: '',
      requestAmount: '3000',
      requestStatus: 'pending',
      requestType: 'card',
      requestDate: '4-4-2026',
      dateOfRequest: '2026-04-04',
    } as any;

    const snapshot = (component as any).buildRetraitTotalSnapshot();

    expect(snapshot).toEqual({
      amountPaid: '12000',
      numberOfPaymentsMade: '6',
      payments: { oldPayment: '2000' },
      withdrawal: { previousWithdrawal: '500' },
      clientCardStatus: '',
      requestAmount: '3000',
      requestStatus: 'pending',
      requestType: 'card',
      requestDate: '4-4-2026',
      dateOfRequest: '2026-04-04',
      returnedAmount: '9000',
      returnDayKey: '4-5-2026',
      capturedAt: '4-5-2026-10-11-12',
    });
    expect(snapshot.payments).not.toBe(component.clientCard.payments);
    expect(snapshot.withdrawal).not.toBe(component.clientCard.withdrawal);
  });
});
