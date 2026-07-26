export interface WeeklyObjectiveAdjustmentConfig {
  bandFc: number;
  penaltyPerBandUsd: number;
  bonusBandFc: number;
  bonusPerBandUsd: number;
}

export type WeeklyObjectiveAdjustmentKind =
  | 'deduction'
  | 'neutral'
  | 'bonus';

export interface WeeklyObjectiveAdjustmentResult {
  kind: WeeklyObjectiveAdjustmentKind;
  amountUsd: number;
  signedAmountUsd: number;
  bandCount: number;
}

export const DEFAULT_WEEKLY_OBJECTIVE_ADJUSTMENT_CONFIG: WeeklyObjectiveAdjustmentConfig =
  {
    bandFc: 100000,
    penaltyPerBandUsd: 1,
    bonusBandFc: 100000,
    bonusPerBandUsd: 1,
  };

export function computeWeeklyObjectiveAdjustment(
  weeklyTotalFc: number,
  weeklyDeductionTargetFc: number,
  weeklyVisibleTargetFc: number,
  config: WeeklyObjectiveAdjustmentConfig
): WeeklyObjectiveAdjustmentResult {
  const totalFc = Math.max(0, Number(weeklyTotalFc) || 0);
  const deductionTargetFc = Number(weeklyDeductionTargetFc) || 0;
  const visibleTargetFc = Number(weeklyVisibleTargetFc) || 0;
  const deductionBandFc = Math.max(1, Number(config?.bandFc) || 0);
  const penaltyPerBandUsd = Math.max(
    0,
    Number(config?.penaltyPerBandUsd) || 0
  );
  const bonusBandFc = Math.max(1, Number(config?.bonusBandFc) || 0);
  const bonusPerBandUsd = Math.max(0, Number(config?.bonusPerBandUsd) || 0);

  if (
    Number.isFinite(deductionTargetFc) &&
    deductionTargetFc > 0 &&
    totalFc < deductionTargetFc
  ) {
    const bandCount = Math.ceil(
      (deductionTargetFc - totalFc) / deductionBandFc
    );
    const amountUsd = bandCount * penaltyPerBandUsd;
    return {
      kind: 'deduction',
      amountUsd,
      signedAmountUsd: -amountUsd,
      bandCount,
    };
  }

  if (
    !Number.isFinite(visibleTargetFc) ||
    visibleTargetFc <= 0 ||
    totalFc < visibleTargetFc ||
    bonusPerBandUsd <= 0
  ) {
    return {
      kind: 'neutral',
      amountUsd: 0,
      signedAmountUsd: 0,
      bandCount: 0,
    };
  }

  const bandCount =
    Math.floor((totalFc - visibleTargetFc) / bonusBandFc) + 1;
  const amountUsd = bandCount * bonusPerBandUsd;

  return {
    kind: amountUsd > 0 ? 'bonus' : 'neutral',
    amountUsd,
    signedAmountUsd: amountUsd,
    bandCount,
  };
}
