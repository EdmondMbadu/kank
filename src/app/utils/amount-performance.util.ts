export type AmountPerformanceDataStatus =
  | 'ready'
  | 'partial'
  | 'unavailable';

export interface AmountPerformanceDayRecord {
  dayKey: string;
  expected: number;
  total: number;
  expectedPresent: boolean;
  totalPresent: boolean;
  employeeUid?: string;
}

export interface AmountPerformanceSummary {
  collectedFc: number;
  expectedFc: number;
  percent: number | null;
  visualPercent: number;
  throughDate: Date | null;
  throughDayKey: string;
  sourceRecordCount: number;
  expectedDayCount: number;
  missingExpectedOnPaidRecordCount: number;
  reconciliationDifferenceFc: number;
  status: AmountPerformanceDataStatus;
}

function finiteNonNegative(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export function parseAmountPerformanceDayKey(dayKey: string): Date | null {
  const [month, day, year] = String(dayKey || '')
    .split('-')
    .slice(0, 3)
    .map(Number);

  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function amountPerformanceCutoff(
  month: number,
  year: number,
  asOf: Date
): Date | null {
  const selectedStart = new Date(year, month - 1, 1);
  selectedStart.setHours(0, 0, 0, 0);

  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);

  if (selectedStart > today) return null;

  const selectedEnd = new Date(year, month, 0);
  selectedEnd.setHours(0, 0, 0, 0);
  return selectedEnd < today ? selectedEnd : today;
}

function formatDayKey(date: Date | null): string {
  if (!date) return '';
  return `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
}

function isInScope(
  dayKey: string,
  month: number,
  year: number,
  cutoff: Date | null
): boolean {
  if (!cutoff) return false;
  const date = parseAmountPerformanceDayKey(dayKey);
  return !!(
    date &&
    date.getMonth() + 1 === month &&
    date.getFullYear() === year &&
    date <= cutoff
  );
}

export function sumAmountMapThroughDate(
  amounts: Record<string, string | number> | null | undefined,
  month: number,
  year: number,
  asOf: Date
): number {
  const cutoff = amountPerformanceCutoff(month, year, asOf);
  if (!cutoff || !amounts) return 0;

  return Object.entries(amounts).reduce((sum, [dayKey, value]) => {
    if (!isInScope(dayKey, month, year, cutoff)) return sum;
    return sum + finiteNonNegative(value);
  }, 0);
}

export function buildAmountPerformanceSummary(options: {
  records: AmountPerformanceDayRecord[];
  month: number;
  year: number;
  asOf: Date;
  collectedOverrideFc?: number;
  reconciliationDifferenceFc?: number;
}): AmountPerformanceSummary {
  const cutoff = amountPerformanceCutoff(
    options.month,
    options.year,
    options.asOf
  );
  const scopedRecords = (options.records || []).filter((record) =>
    isInScope(record.dayKey, options.month, options.year, cutoff)
  );

  const recordCollectedFc = scopedRecords.reduce(
    (sum, record) => sum + finiteNonNegative(record.total),
    0
  );
  const collectedFc = Number.isFinite(options.collectedOverrideFc)
    ? finiteNonNegative(options.collectedOverrideFc)
    : recordCollectedFc;
  const expectedFc = scopedRecords.reduce(
    (sum, record) => sum + finiteNonNegative(record.expected),
    0
  );
  const expectedDays = new Set(
    scopedRecords
      .filter((record) => record.expectedPresent)
      .map((record) => record.dayKey)
  );
  const missingExpectedOnPaidRecordCount = scopedRecords.filter(
    (record) =>
      finiteNonNegative(record.total) > 0 && !record.expectedPresent
  ).length;
  const reconciliationDifferenceFc = finiteNonNegative(
    options.reconciliationDifferenceFc
  );

  const percent =
    expectedFc > 0 ? (collectedFc / expectedFc) * 100 : null;
  const visualPercent =
    percent === null ? 0 : Math.max(0, Math.min(100, percent));

  let status: AmountPerformanceDataStatus = 'ready';
  if (!cutoff || expectedFc <= 0) {
    status = 'unavailable';
  } else if (
    missingExpectedOnPaidRecordCount > 0 ||
    reconciliationDifferenceFc > 0
  ) {
    status = 'partial';
  }

  return {
    collectedFc,
    expectedFc,
    percent,
    visualPercent,
    throughDate: cutoff,
    throughDayKey: formatDayKey(cutoff),
    sourceRecordCount: scopedRecords.length,
    expectedDayCount: expectedDays.size,
    missingExpectedOnPaidRecordCount,
    reconciliationDifferenceFc,
    status,
  };
}
