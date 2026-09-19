import { Client } from 'src/app/models/client';
import { buildPaymentReminderProjection } from './payment-reminder-projection.util';

describe('buildPaymentReminderProjection', () => {
  const client = (overrides: Partial<Client> = {}): Client =>
    ({
      uid: 'client-1',
      firstName: 'Ada',
      lastName: 'Test',
      phoneNumber: '0990000000',
      isPhoneCorrect: 'true',
      paymentDay: 'Tuesday',
      debtCycleStartDate: '08-01-2026',
      debtLeft: '800',
      amountToPay: '1000',
      paymentPeriodRange: '4',
      locationName: 'Gombe',
      ...overrides,
    } as Client);

  const expectedPayment = (value: Client) =>
    Math.min(
      Number(value.debtLeft || 0),
      Number(value.amountToPay || 0) / Number(value.paymentPeriodRange || 1)
    );
  const isQuitte = (value: Client) => value.vitalStatus === 'Quitté';

  it('projects the selected weekday and aggregates target amounts', () => {
    const projection = buildPaymentReminderProjection(
      [
        client(),
        client({ uid: 'client-2', locationName: 'Limete', debtLeft: '200' }),
        client({ uid: 'client-3', paymentDay: 'Wednesday' }),
      ],
      {
        dateKey: '2026-09-22',
        sendMode: 'all',
        isQuitte,
        expectedPayment,
      }
    );

    expect(projection.totalClients).toBe(2);
    expect(projection.targetCount).toBe(2);
    expect(projection.siteCount).toBe(2);
    expect(projection.debtTotal).toBe(1000);
    expect(projection.expectedPaymentTotal).toBe(450);
  });

  it('applies the send rule, phone eligibility, and site filter', () => {
    const projection = buildPaymentReminderProjection(
      [
        client({ uid: 'active' }),
        client({ uid: 'left', vitalStatus: 'Quitté' }),
        client({ uid: 'bad-phone', phoneNumber: '', locationName: 'Limete' }),
      ],
      {
        dateKey: '2026-09-22',
        sendMode: 'excludeQuitte',
        locationFilter: 'Gombe',
        isQuitte,
        expectedPayment,
      }
    );

    expect(projection.totalClients).toBe(2);
    expect(projection.targetCount).toBe(1);
    expect(projection.excludedQuitteCount).toBe(1);
    expect(projection.allLocations).toEqual(['Gombe', 'Limete']);
  });

  it('does not include a client before the first eligible reminder week', () => {
    const projection = buildPaymentReminderProjection(
      [client({ debtCycleStartDate: '09-20-2026' })],
      {
        dateKey: '2026-09-22',
        sendMode: 'all',
        isQuitte,
        expectedPayment,
      }
    );

    expect(projection.totalClients).toBe(0);
  });
});
