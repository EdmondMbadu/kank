import { WeeklyPaymentTargetPeriod } from '../models/weekly-payment-target';

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_DAY_YEAR_RE = /^\d{1,2}-\d{1,2}-\d{4}$/;

export function parseWeeklyPaymentTargetDate(
  value: string | Date | null | undefined
): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const normalized = new Date(value);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  if (ISO_DATE_ONLY_RE.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() + 1 !== month ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  if (MONTH_DAY_YEAR_RE.test(raw)) {
    const [month, day, year] = raw.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() + 1 !== month ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  return null;
}

export function formatWeeklyPaymentTargetDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeWeeklyPaymentTargetPeriods(
  input: unknown
): WeeklyPaymentTargetPeriod[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item: any) => {
      const targetFc = Number(item?.targetFc);
      const start = parseWeeklyPaymentTargetDate(item?.startDateIso);
      const end = parseWeeklyPaymentTargetDate(item?.endDateIso);
      if (
        !Number.isFinite(targetFc) ||
        targetFc <= 0 ||
        !start ||
        !end ||
        end < start
      ) {
        return null;
      }

      return {
        startDateIso: formatWeeklyPaymentTargetDateIso(start),
        endDateIso: formatWeeklyPaymentTargetDateIso(end),
        targetFc,
      } as WeeklyPaymentTargetPeriod;
    })
    .filter((item): item is WeeklyPaymentTargetPeriod => !!item)
    .sort((a, b) => {
      if (a.startDateIso === b.startDateIso) {
        return a.endDateIso.localeCompare(b.endDateIso);
      }
      return a.startDateIso.localeCompare(b.startDateIso);
    });
}

export function hasOverlappingWeeklyPaymentTargetPeriods(
  periods: WeeklyPaymentTargetPeriod[]
): boolean {
  const normalized = normalizeWeeklyPaymentTargetPeriods(periods);
  for (let i = 1; i < normalized.length; i += 1) {
    const previous = normalized[i - 1];
    const current = normalized[i];
    if (previous.endDateIso >= current.startDateIso) {
      return true;
    }
  }
  return false;
}

export function findMatchingWeeklyPaymentTargetPeriod(
  periods: WeeklyPaymentTargetPeriod[],
  dateInput: string | Date | null | undefined
): WeeklyPaymentTargetPeriod | null {
  const normalizedDate = parseWeeklyPaymentTargetDate(dateInput);
  if (!normalizedDate) {
    return null;
  }
  const targetDateIso = formatWeeklyPaymentTargetDateIso(normalizedDate);
  const normalizedPeriods = normalizeWeeklyPaymentTargetPeriods(periods);

  for (let index = normalizedPeriods.length - 1; index >= 0; index -= 1) {
    const period = normalizedPeriods[index];
    if (
      period.startDateIso <= targetDateIso &&
      targetDateIso <= period.endDateIso
    ) {
      return period;
    }
  }

  return null;
}

export function findNextWeeklyPaymentTargetPeriod(
  periods: WeeklyPaymentTargetPeriod[],
  dateInput: string | Date | null | undefined
): WeeklyPaymentTargetPeriod | null {
  const normalizedDate = parseWeeklyPaymentTargetDate(dateInput);
  if (!normalizedDate) {
    return null;
  }
  const targetDateIso = formatWeeklyPaymentTargetDateIso(normalizedDate);
  const normalizedPeriods = normalizeWeeklyPaymentTargetPeriods(periods);

  return (
    normalizedPeriods.find((period) => period.startDateIso > targetDateIso) ||
    null
  );
}

export function resolveWeeklyPaymentTargetForDate(options: {
  dateInput: string | Date | null | undefined;
  userPeriods?: WeeklyPaymentTargetPeriod[] | null | undefined;
  userFallbackTargetFc?: number | string | null | undefined;
  globalPeriods?: WeeklyPaymentTargetPeriod[] | null | undefined;
  globalFallbackTargetFc?: number | string | null | undefined;
  defaultTargetFc?: number;
}): number {
  const defaultTargetFc = Number(options.defaultTargetFc || 600000);
  const userPeriod = findMatchingWeeklyPaymentTargetPeriod(
    options.userPeriods || [],
    options.dateInput
  );
  if (userPeriod) {
    return userPeriod.targetFc;
  }

  const userFallbackTargetFc = Number(options.userFallbackTargetFc);
  if (Number.isFinite(userFallbackTargetFc) && userFallbackTargetFc > 0) {
    return userFallbackTargetFc;
  }

  const globalPeriod = findMatchingWeeklyPaymentTargetPeriod(
    options.globalPeriods || [],
    options.dateInput
  );
  if (globalPeriod) {
    return globalPeriod.targetFc;
  }

  const globalFallbackTargetFc = Number(options.globalFallbackTargetFc);
  if (Number.isFinite(globalFallbackTargetFc) && globalFallbackTargetFc > 0) {
    return globalFallbackTargetFc;
  }

  return Number.isFinite(defaultTargetFc) && defaultTargetFc > 0
    ? defaultTargetFc
    : 600000;
}
