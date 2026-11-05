import { Client } from '../models/client';

export interface PaymentPerformanceSnapshot {
  readonly client: Readonly<Pick<Client,
    'uid' | 'amountToPay' | 'paymentPeriodRange' | 'debtCycleStartDate'>>;
  readonly paymentAmount: string;
}

/** Copy only scalar inputs used for points, before any asynchronous payment work. */
export function capturePaymentPerformance(
  client: Client,
  paymentAmount: string
): PaymentPerformanceSnapshot {
  return {
    client: {
      uid: client.uid,
      amountToPay: client.amountToPay,
      paymentPeriodRange: client.paymentPeriodRange,
      debtCycleStartDate: client.debtCycleStartDate,
    },
    paymentAmount,
  };
}

/** Call only after payment success. Never wait on points or retry the payment. */
export function recordPaymentPerformanceInBackground(
  performance: { updateUserPerformance: (client: Client, amount: string) => unknown },
  snapshot: PaymentPerformanceSnapshot
): void {
  if (!(Number(snapshot.paymentAmount) > 0)) return;
  const report = (error: unknown) =>
    console.error('Payment saved, but performance update failed:', error);
  try {
    void Promise.resolve(performance.updateUserPerformance(
      snapshot.client, snapshot.paymentAmount
    )).catch(report);
  } catch (error) {
    report(error);
  }
}
