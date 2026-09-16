import { buildDailyActivityRows, parseActivityDate } from './daily-activity-details';

describe('Daily central activity extraction', () => {
  it('matches exact calendar dates, with padded/legacy/ISO keys, without timezone shifts', () => {
    expect(parseActivityDate('09-01-2026-8-2-3')?.dayKey).toBe('9-1-2026');
    expect(parseActivityDate('2026-09-01T00:30:00Z')?.dayKey).toBe('9-1-2026');
    expect(parseActivityDate('2026-09-01')?.monthKey).toBe('2026-09');
    expect(parseActivityDate('9-1-2026-8-0-0-123')?.dayKey).toBe('9-1-2026');
    const rows = buildDailyActivityRows([{
      uid: 'a', payments: {
        '9-1-2026-8-0-0': '100', '9-10-2026-8-0-0': '200',
        '09-01-2026-9-0-0': '300', '2026-09-01T10:00:00Z': '400',
      },
    }], 'payment', '9-1-2026');
    expect(rows.length).toBe(3);
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(800);
  });

  it('rejects invalid dates and amounts instead of silently rolling dates over', () => {
    ['2-30-2026', '13-1-2026', '9-0-2026', '9-1-2026-24-0-0', 'garbage'].forEach((key) =>
      expect(parseActivityDate(key)).toBeNull()
    );
    const rows = buildDailyActivityRows([{
      payments: {
        '9-1-2026-8-0-0': 'NaN', '9-1-2026-9-0-0': 'Infinity',
        '9-1-2026-10-0-0': '0', '9-1-2026-11-0-0': '-50',
      },
    }], 'payment', '9-1-2026');
    expect(rows.map((row) => row.amount)).toEqual([-50]);
    expect(buildDailyActivityRows([], 'payment', 'invalid')).toEqual([]);
  });

  it('combines current/previous cycles, prefers current values, and keeps distinct clients/sites', () => {
    const clients = [{
      uid: 'a', locationOwnerId: 'site-a', firstName: 'Esther',
      previousPayments: { '9-1-2026-8-0-0': '100', '9-1-2026-9-0-0': '50' },
      payments: { '9-1-2026-8-0-0': '200' },
      paymentSources: { '9-1-2026-8-0-0': 'mobile_money' as const },
    }, {
      uid: 'b', locationOwnerId: 'site-a', firstName: 'Esther',
      payments: { '9-1-2026-8-0-0': '300' },
    }, {
      uid: 'a', locationOwnerId: 'site-b', firstName: 'Esther',
      payments: { '9-1-2026-8-0-0': '400' },
    }];
    const rows = buildDailyActivityRows(clients, 'payment', '9-1-2026');
    expect(rows.length).toBe(4);
    expect(new Set(rows.map((row) => row.id)).size).toBe(4);
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(950);
    expect(rows.find((row) => row.amount === 200)?.detail).toBe('Mobile Money');
  });

  it('groups by location alphabetically, then sorts newest payments first within each site', () => {
    const rows = buildDailyActivityRows([{
      uid: 'b', locationOwnerId: 'b', locationName: 'Zongo',
      payments: { '9-1-2026-10-0-0': '300' },
    }, {
      uid: 'a', locationOwnerId: 'a', locationName: 'Bandal',
      payments: { '9-1-2026-8-0-0': '100', '9-1-2026-9-0-0': '200' },
    }], 'payment', '9-1-2026');
    expect(rows.map((row) => row.amount)).toEqual([200, 100, 300]);
    expect(rows.map((row) => row.locationName)).toEqual(['Bandal', 'Bandal', 'Zongo']);
  });

  it('lists only positive loans whose current cycle starts on the selected day', () => {
    const rows = buildDailyActivityRows([
      { uid: 'a', debtCycleStartDate: '09-01-2026', loanAmount: '1000', paymentPeriodRange: '9 semaines' },
      { uid: 'b', debtCycleStartDate: '9-10-2026', loanAmount: '2000' },
      { uid: 'c', debtCycleStartDate: '9-1-2026', loanAmount: '0' },
      { uid: 'd', debtCycleStartDate: '9-1-2026', loanAmount: '-500' },
    ], 'lending', '9-1-2026');
    expect(rows.length).toBe(1);
    expect(rows[0].amount).toBe(1000);
    expect(rows[0].detail).toBe('9 semaines');
  });

  it('does not count pending transfer copies as destination payments or loans', () => {
    const source = {
      uid: 'source', locationOwnerId: 'a', debtCycleStartDate: '9-1-2026', loanAmount: '1000',
      payments: { '9-1-2026': '100' },
    };
    const pending = { ...source, uid: 'copy', locationOwnerId: 'b', transferStatus: 'pending' as const };
    expect(buildDailyActivityRows([source, pending], 'payment', '9-1-2026').length).toBe(1);
    expect(buildDailyActivityRows([source, pending], 'lending', '9-1-2026').length).toBe(1);
  });
});
