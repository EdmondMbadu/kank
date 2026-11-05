import { Client } from '../models/client';
import { capturePaymentPerformance, recordPaymentPerformanceInBackground } from './payment-performance.util';

describe('payment performance completion', () => {
  it('retains scalar inputs even if the original client is mutated in place', () => {
    const client: Client = {uid: 'client', amountToPay: '560000', paymentPeriodRange: '8',
      debtCycleStartDate: '8-13-2026', payments: {'11-3-2026-13-38-34': '130000'}};
    const snapshot = capturePaymentPerformance(client, '130000');
    client.uid = 'replacement'; client.amountToPay = '0'; client.paymentPeriodRange = '4';
    client.debtCycleStartDate = '11-3-2026';
    expect(snapshot).toEqual({client: {uid: 'client', amountToPay: '560000',
      paymentPeriodRange: '8', debtCycleStartDate: '8-13-2026'}, paymentAmount: '130000'});
    expect(Object.keys(snapshot.client).length).toBe(4);
  });

  for (const amount of ['0', '-100', '', 'invalid']) {
    it(`does not award payment points for ${JSON.stringify(amount)}`, () => {
      const performance = {updateUserPerformance: jasmine.createSpy('update')};
      recordPaymentPerformanceInBackground(performance, capturePaymentPerformance({}, amount));
      expect(performance.updateUserPerformance).not.toHaveBeenCalled();
    });
  }

  it('returns immediately while the performance write remains pending', () => {
    const performance = {updateUserPerformance: jasmine.createSpy('update')
      .and.returnValue(new Promise(() => {}))};
    const result = recordPaymentPerformanceInBackground(performance, capturePaymentPerformance({}, '100'));
    expect(result).toBeUndefined();
    expect(performance.updateUserPerformance).toHaveBeenCalledTimes(1);
  });
});
