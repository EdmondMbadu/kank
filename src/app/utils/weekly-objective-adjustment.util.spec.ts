import {
  computeWeeklyObjectiveAdjustment,
  DEFAULT_WEEKLY_OBJECTIVE_ADJUSTMENT_CONFIG,
} from './weekly-objective-adjustment.util';

describe('computeWeeklyObjectiveAdjustment', () => {
  const config = DEFAULT_WEEKLY_OBJECTIVE_ADJUSTMENT_CONFIG;
  const deductionTargetFc = 900000;
  const visibleTargetFc = 1200000;

  it('applies the full deduction at the bottom band', () => {
    expect(
      computeWeeklyObjectiveAdjustment(
        34000,
        deductionTargetFc,
        visibleTargetFc,
        config
      )
    ).toEqual({
      kind: 'deduction',
      amountUsd: 9,
      signedAmountUsd: -9,
      bandCount: 9,
    });
  });

  it('keeps the corridor between payroll and visible targets neutral', () => {
    expect(
      computeWeeklyObjectiveAdjustment(
        1100000,
        deductionTargetFc,
        visibleTargetFc,
        config
      )
    ).toEqual({
      kind: 'neutral',
      amountUsd: 0,
      signedAmountUsd: 0,
      bandCount: 0,
    });
  });

  it('awards one dollar when the visible target is reached', () => {
    expect(
      computeWeeklyObjectiveAdjustment(
        1200000,
        deductionTargetFc,
        visibleTargetFc,
        config
      )
    ).toEqual({
      kind: 'bonus',
      amountUsd: 1,
      signedAmountUsd: 1,
      bandCount: 1,
    });
  });

  it('awards two dollars at 1.3M FC', () => {
    expect(
      computeWeeklyObjectiveAdjustment(
        1300000,
        deductionTargetFc,
        visibleTargetFc,
        config
      )
    ).toEqual({
      kind: 'bonus',
      amountUsd: 2,
      signedAmountUsd: 2,
      bandCount: 2,
    });
  });

  it('continues increasing the weekly bonus without a ceiling', () => {
    expect(
      computeWeeklyObjectiveAdjustment(
        2500000,
        deductionTargetFc,
      visibleTargetFc,
      config
      )
    ).toEqual({
      kind: 'bonus',
      amountUsd: 14,
      signedAmountUsd: 14,
      bandCount: 14,
    });
  });
});
