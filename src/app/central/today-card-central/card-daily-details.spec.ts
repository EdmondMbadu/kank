import { buildDailyCardRows, compactDailyCard, DailyCardSnapshot } from './card-daily-details';

describe('Daily card client details', () => {
  const base: DailyCardSnapshot = {
    uid: 'card', locationId: 'a', locationName: 'Bandal',
    firstName: 'Esther', middleName: 'Marie', lastName: 'Mbala',
    cardCycle: '1', dateJoined: '9-1-2026', amountToPay: '5000',
  };

  it('matches exact days, preserves signed payments, and deduplicates snapshot overlaps', () => {
    const rows = buildDailyCardRows([{ ...base,
      totalWithdrawalSnapshot: { payments: { '9-1-2026-8-0-0': '100', '9-1-2026-9-0-0': '300' } },
      payments: { '9-1-2026-8-0-0': '200', '09-01-2026-10-0-0': '-50', '9-10-2026': '999',
        '2026-09-01T11:00:00Z': '400', '9-1-2026-12-0-0': 'NaN', '9-1-2026-13-0-0': 'Infinity', '9-1-2026-14-0-0': '0' },
    }], 0, '9-1-2026');
    expect(rows.map((row) => row.amount)).toEqual([400, -50, 300, 200]);
    expect(rows[0].fullName).toBe('Esther Marie Mbala');
    expect(rows[1].detail).toContain('Retrait partiel');
    expect(buildDailyCardRows([base], 0, 'invalid')).toEqual([]);
    expect(buildDailyCardRows([base], 4, '9-1-2026')).toEqual([]);
  });

  it('lists actual withdrawals without treating savings or requests as payouts', () => {
    const rows = buildDailyCardRows([{ ...base,
      totalWithdrawalSnapshot: { withdrawal: { '9-1-2026-8-0-0': '9000' } },
      withdrawal: { '9-1-2026-8-0-0': '8000', '9-1-2026-9-0-0': '-100', '9-10-2026': '1000' },
    }], 1, '9-1-2026');
    expect(rows.map((row) => row.amount)).toEqual([8000]);
  });

  it('attributes benefits to creation and new cycles, with historic fees from the snapshot', () => {
    const rows = buildDailyCardRows([base, { ...base, uid: 'cycle', cardCycle: '2',
      amountToPay: '10000', dateJoined: '9-1-2026', cardCycleStartDate: '9-1-2026',
      totalWithdrawalSnapshot: { cardCycle: '1', amountPaid: '63000', returnedAmount: '60000' },
    }], 2, '9-1-2026');
    expect(rows.map((row) => row.amount).sort((a, b) => a - b)).toEqual([3000, 5000, 10000]);
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(18000);
    expect(buildDailyCardRows([{ ...base, cardCycle: '3', cardCycleStartDate: '9-2-2026' }], 2, '9-1-2026')).toEqual([]);
  });

  it('keeps client IDs scoped to a site and orders clients under their location', () => {
    const rows = buildDailyCardRows([
      { ...base, locationId: 'z', locationName: 'Zongo', payments: { '9-1-2026': '100' } },
      { ...base, payments: { '9-1-2026-8-0-0': '200', '9-1-2026-9-0-0': '300' } },
    ], 0, '9-1-2026');
    expect(rows.map((row) => row.locationName)).toEqual(['Bandal', 'Bandal', 'Zongo']);
    expect(rows.map((row) => row.amount)).toEqual([300, 200, 100]);
    expect(new Set(rows.map((row) => row.id)).size).toBe(3);
  });

  it('retains only selected-month histories and strips unrelated card payloads', () => {
    const card = compactDailyCard({ ...base, galleryPictures: { x: {} as any },
      payments: { '9-1-2026': '100', '10-1-2026': '200' },
      totalWithdrawalSnapshot: { cardCycle: '1', payments: { '9-2-2026': '300', '8-2-2026': '400' } },
    }, 'site', 'Site', '2026-09');
    expect(card.payments).toEqual({ '9-1-2026': '100' });
    expect(card.totalWithdrawalSnapshot?.payments).toEqual({ '9-2-2026': '300' });
    expect((card as any).galleryPictures).toBeUndefined();
  });
});
