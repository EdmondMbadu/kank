import {
  findMatchingWeeklyPaymentTargetPeriod,
  hasOverlappingWeeklyPaymentTargetPeriods,
  normalizeWeeklyPaymentTargetPeriods,
  resolveWeeklyPaymentTargetForDate,
} from './weekly-payment-target.util';

describe('weekly-payment-target.util', () => {
  it('matches a configured period using inclusive start and end dates', () => {
    const periods = normalizeWeeklyPaymentTargetPeriods([
      {
        startDateIso: '2026-01-01',
        endDateIso: '2026-03-31',
        targetFc: 600000,
      },
    ]);

    const match = findMatchingWeeklyPaymentTargetPeriod(periods, '2026-03-31');

    expect(match?.targetFc).toBe(600000);
  });

  it('falls back to the current global target when no period matches', () => {
    const target = resolveWeeklyPaymentTargetForDate({
      dateInput: '2026-04-07',
      globalPeriods: [
        {
          startDateIso: '2026-01-01',
          endDateIso: '2026-03-31',
          targetFc: 600000,
        },
      ],
      globalFallbackTargetFc: 900000,
      defaultTargetFc: 600000,
    });

    expect(target).toBe(900000);
  });

  it('uses the period active at the start of a carryover week', () => {
    const target = resolveWeeklyPaymentTargetForDate({
      dateInput: '3-30-2026',
      globalPeriods: [
        {
          startDateIso: '2026-01-01',
          endDateIso: '2026-03-31',
          targetFc: 600000,
        },
      ],
      globalFallbackTargetFc: 900000,
      defaultTargetFc: 600000,
    });

    expect(target).toBe(600000);
  });

  it('prefers a user-specific period over the global configuration', () => {
    const target = resolveWeeklyPaymentTargetForDate({
      dateInput: '2026-02-10',
      userPeriods: [
        {
          startDateIso: '2026-02-01',
          endDateIso: '2026-02-28',
          targetFc: 500000,
        },
      ],
      userFallbackTargetFc: 700000,
      globalPeriods: [
        {
          startDateIso: '2026-01-01',
          endDateIso: '2026-03-31',
          targetFc: 600000,
        },
      ],
      globalFallbackTargetFc: 900000,
      defaultTargetFc: 600000,
    });

    expect(target).toBe(500000);
  });

  it('detects overlapping configured periods', () => {
    const overlaps = hasOverlappingWeeklyPaymentTargetPeriods([
      {
        startDateIso: '2026-01-01',
        endDateIso: '2026-03-31',
        targetFc: 600000,
      },
      {
        startDateIso: '2026-03-15',
        endDateIso: '2026-04-30',
        targetFc: 900000,
      },
    ]);

    expect(overlaps).toBeTrue();
  });
});
