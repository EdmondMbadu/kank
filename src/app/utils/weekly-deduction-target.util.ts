import { WeeklyDeductionTargetVersion } from '../models/weekly-deduction-target';
import {
  formatWeeklyPaymentTargetDateIso,
  parseWeeklyPaymentTargetDate,
} from './weekly-payment-target.util';

export function normalizeWeeklyDeductionTargetVersions(
  input: unknown
): WeeklyDeductionTargetVersion[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const byEffectiveDate = new Map<string, WeeklyDeductionTargetVersion>();

  input.forEach((item: any) => {
    const effectiveDate = parseWeeklyPaymentTargetDate(
      item?.effectiveDateIso
    );
    const targetFc = Number(item?.targetFc);
    if (!effectiveDate || !Number.isFinite(targetFc) || targetFc <= 0) {
      return;
    }

    const effectiveDateIso =
      formatWeeklyPaymentTargetDateIso(effectiveDate);
    byEffectiveDate.set(effectiveDateIso, {
      effectiveDateIso,
      targetFc,
    });
  });

  return Array.from(byEffectiveDate.values()).sort((a, b) =>
    a.effectiveDateIso.localeCompare(b.effectiveDateIso)
  );
}

export function resolveWeeklyDeductionTargetForDate(options: {
  dateInput: string | Date | null | undefined;
  versions?: WeeklyDeductionTargetVersion[] | null | undefined;
  fallbackTargetFc: number;
}): number {
  const date = parseWeeklyPaymentTargetDate(options.dateInput);
  const fallbackTargetFc = Number(options.fallbackTargetFc);
  if (!date) {
    return Number.isFinite(fallbackTargetFc) && fallbackTargetFc > 0
      ? fallbackTargetFc
      : 600000;
  }

  const dateIso = formatWeeklyPaymentTargetDateIso(date);
  const versions = normalizeWeeklyDeductionTargetVersions(options.versions);
  for (let index = versions.length - 1; index >= 0; index -= 1) {
    if (versions[index].effectiveDateIso <= dateIso) {
      return versions[index].targetFc;
    }
  }

  return Number.isFinite(fallbackTargetFc) && fallbackTargetFc > 0
    ? fallbackTargetFc
    : 600000;
}
