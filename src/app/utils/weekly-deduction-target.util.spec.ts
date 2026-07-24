import {
  normalizeWeeklyDeductionTargetVersions,
  resolveWeeklyDeductionTargetForDate,
} from './weekly-deduction-target.util';

describe('weekly deduction target utilities', () => {
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
