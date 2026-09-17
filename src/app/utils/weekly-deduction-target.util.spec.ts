import {
  normalizeWeeklyDeductionTargetVersions,
  resolveWeeklyDeductionTargetForDate,
} from './weekly-deduction-target.util';

describe('weekly deduction target utilities', () => {
  it('uses an explicit site deduction period only during that period', () => {
    const options = {
      userPeriods: [{ startDateIso: '2026-09-14', endDateIso: '2026-09-20', targetFc: 700000 }],
      versions: [{ effectiveDateIso: '2026-09-01', targetFc: 900000 }],
      fallbackTargetFc: 1200000,
    };
    expect(resolveWeeklyDeductionTargetForDate({ ...options, dateInput: '2026-09-13' })).toBe(900000);
    expect(resolveWeeklyDeductionTargetForDate({ ...options, dateInput: '2026-09-17' })).toBe(700000);
    expect(resolveWeeklyDeductionTargetForDate({ ...options, dateInput: '2026-09-21' })).toBe(900000);
  });
  it('uses the visible target before the first separate payroll threshold', () => {
    expect(
      resolveWeeklyDeductionTargetForDate({
        dateInput: '2026-07-13',
        versions: [
          { effectiveDateIso: '2026-07-20', targetFc: 900000 },
        ],
        fallbackTargetFc: 1200000,
      })
    ).toBe(1200000);
  });

  it('keeps the latest effective payroll threshold active until changed', () => {
    const versions = [
      { effectiveDateIso: '2026-07-20', targetFc: 900000 },
      { effectiveDateIso: '2026-09-07', targetFc: 1000000 },
    ];

    expect(
      resolveWeeklyDeductionTargetForDate({
        dateInput: '2026-08-31',
        versions,
        fallbackTargetFc: 1200000,
      })
    ).toBe(900000);
    expect(
      resolveWeeklyDeductionTargetForDate({
        dateInput: '2026-09-07',
        versions,
        fallbackTargetFc: 1200000,
      })
    ).toBe(1000000);
  });

  it('normalizes dates and replaces duplicate effective dates', () => {
    expect(
      normalizeWeeklyDeductionTargetVersions([
        { effectiveDateIso: '2026-07-20', targetFc: 800000 },
        { effectiveDateIso: '2026-07-20', targetFc: 900000 },
        { effectiveDateIso: 'invalid', targetFc: 1000000 },
      ])
    ).toEqual([{ effectiveDateIso: '2026-07-20', targetFc: 900000 }]);
  });
});
