import {
  AmountPerformanceDayRecord,
  buildAmountPerformanceSummary,
  sumAmountMapThroughDate,
} from './amount-performance.util';

describe('amount performance', () => {
  const record = (
    dayKey: string,
    total: number,
    expected: number,
    expectedPresent = true
  ): AmountPerformanceDayRecord => ({
    dayKey,
    total,
    expected,
    expectedPresent,
    totalPresent: true,
  });

  it('computes the selected month only through the current day', () => {
    const summary = buildAmountPerformanceSummary({
      records: [
        record('8-3-2026', 200000, 400000),
        record('8-5-2026', 300000, 600000),
        record('8-6-2026', 900000, 900000),
        record('7-31-2026', 900000, 900000),
      ],
      month: 8,
      year: 2026,
      asOf: new Date(2026, 7, 5, 18),
    });

    expect(summary.collectedFc).toBe(500000);
    expect(summary.expectedFc).toBe(1000000);
    expect(summary.percent).toBe(50);
    expect(summary.throughDayKey).toBe('8-5-2026');
  });

  it('keeps the raw percentage above 100 while clamping only the ring', () => {
    const summary = buildAmountPerformanceSummary({
      records: [record('8-5-2026', 1200000, 1000000)],
      month: 8,
      year: 2026,
      asOf: new Date(2026, 7, 5),
    });

    expect(summary.percent).toBe(120);
    expect(summary.visualPercent).toBe(100);
  });

  it('marks a paid record without an expected snapshot as partial', () => {
    const summary = buildAmountPerformanceSummary({
      records: [
        record('8-4-2026', 100000, 200000),
        record('8-5-2026', 50000, 0, false),
      ],
      month: 8,
      year: 2026,
      asOf: new Date(2026, 7, 5),
    });

    expect(summary.status).toBe('partial');
    expect(summary.missingExpectedOnPaidRecordCount).toBe(1);
  });

  it('marks a site reconciliation difference as partial', () => {
    const summary = buildAmountPerformanceSummary({
      records: [record('8-5-2026', 500000, 1000000)],
      month: 8,
      year: 2026,
      asOf: new Date(2026, 7, 5),
      collectedOverrideFc: 533500,
      reconciliationDifferenceFc: 33500,
    });

    expect(summary.collectedFc).toBe(533500);
    expect(summary.percent).toBeCloseTo(53.35, 6);
    expect(summary.status).toBe('partial');
  });

  it('uses the ratio of site totals rather than averaging employee percentages', () => {
    const summary = buildAmountPerformanceSummary({
      records: [
        { ...record('8-5-2026', 90000, 100000), employeeUid: 'employee-1' },
        { ...record('8-5-2026', 100000, 900000), employeeUid: 'employee-2' },
      ],
      month: 8,
      year: 2026,
      asOf: new Date(2026, 7, 5),
      collectedOverrideFc: 190000,
    });

    expect(summary.collectedFc).toBe(190000);
    expect(summary.expectedFc).toBe(1000000);
    expect(summary.percent).toBe(19);
  });

  it('returns unavailable instead of inventing a percentage with no expected amount', () => {
    const summary = buildAmountPerformanceSummary({
      records: [record('8-5-2026', 100000, 0, false)],
      month: 8,
      year: 2026,
      asOf: new Date(2026, 7, 5),
    });

    expect(summary.percent).toBeNull();
    expect(summary.status).toBe('unavailable');
  });

  it('sums site payments through today without including future days', () => {
    expect(
      sumAmountMapThroughDate(
        {
          '8-3-2026': '200000',
          '8-5-2026': 333500,
          '8-6-2026': 900000,
          '7-31-2026': 900000,
        },
        8,
        2026,
        new Date(2026, 7, 5)
      )
    ).toBe(533500);
  });
});
