import {
  WeeklyObjectiveBonus,
  WeeklyObjectiveDeduction,
} from '../models/employee';

export interface MonthlyPayrollAttendanceDeductions {
  absent: number;
  nothing: number;
  late: number;
}

export interface MonthlyPayrollPaymentInput {
  base: number;
  bankFee: number;
  experience: number;
  manualAddition: number;
  objectiveBonus: number;
  absent: number;
  nothing: number;
  late: number;
  objectiveDeduction: number;
  manualWithdrawal: number;
}

export interface MonthlyPayrollObjectiveAdjustmentOptions {
  month: number;
  year: number;
  today?: Date;
  dailyReimbursement?: Record<string, unknown> | null;
  attendanceOnly?: boolean;
  resolveVisibleTargetFc: (weekStartDateKey: string) => number;
  resolveDeductionTargetFc: (weekStartDateKey: string) => number;
  computeDeductionUsd: (weeklyTotalFc: number, targetFc: number) => number;
  computeBonusUsd: (weeklyTotalFc: number, visibleTargetFc: number) => number;
}

export function computeMonthlyPayrollPayment(
  input: MonthlyPayrollPaymentInput
): number {
  const value = (raw: unknown) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return (
    value(input.base) +
    value(input.bankFee) +
    value(input.experience) +
    Math.max(value(input.manualAddition), 0) +
    value(input.objectiveBonus) -
    value(input.absent) -
    value(input.nothing) -
    value(input.late) -
    value(input.objectiveDeduction) -
    Math.max(value(input.manualWithdrawal), 0)
  );
}

export function computeMonthlyPayrollAttendanceDeductions(
  attendance: Record<string, unknown> | null | undefined,
  month: number,
  year: number
): MonthlyPayrollAttendanceDeductions {
  const byDate = new Map<string, string>();
  Object.entries(attendance || {}).forEach(([key, rawValue]) => {
    const parts = key.split('-');
    if (parts.length < 3) return;
    const normalized = `${Number(parts[0])}-${Number(parts[1])}-${parts[2]}`;
    byDate.set(normalized, String(rawValue));
  });

  let absentCount = 0;
  let nothingCount = 0;
  let lateCount = 0;
  byDate.forEach((status, label) => {
    const [entryMonth, _day, entryYear] = label.split('-').map(Number);
    if (entryMonth !== Number(month) || entryYear !== Number(year)) return;
    if (status === 'A') absentCount += 1;
    if (status === 'N') nothingCount += 1;
    if (status === 'L') lateCount += 1;
  });

  return {
    absent: absentCount * 3,
    nothing: nothingCount * 3,
    late: lateCount,
  };
}

export function computeMonthlyPayrollObjectiveAdjustments(
  options: MonthlyPayrollObjectiveAdjustmentOptions
): {
  deductions: WeeklyObjectiveDeduction[];
  bonuses: WeeklyObjectiveBonus[];
} {
  if (options.attendanceOnly) return { deductions: [], bonuses: [] };

  const today = new Date(options.today || new Date());
  today.setHours(0, 0, 0, 0);
  const lastDay = new Date(options.year, options.month, 0);
  const deductions: WeeklyObjectiveDeduction[] = [];
  const bonuses: WeeklyObjectiveBonus[] = [];
  const payments = options.dailyReimbursement || {};

  const dateKey = (date: Date) =>
    `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
  const isoDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(date.getDate()).padStart(2, '0')}`;

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const end = new Date(options.year, options.month - 1, day);
    if (end.getDay() !== 0 || today <= end) continue;

    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const crossesMonth =
      start.getFullYear() !== end.getFullYear() ||
      start.getMonth() !== end.getMonth();
    if (crossesMonth && end.getDate() === 1) continue;

    const startKey = dateKey(start);
    const weeklyTargetFc = Number(options.resolveVisibleTargetFc(startKey)) || 0;
    const weeklyDeductionTargetFc =
      Number(options.resolveDeductionTargetFc(startKey)) || 0;
    let weeklyTotalFc = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      const amount = Number(payments[dateKey(cursor)] ?? 0);
      if (Number.isFinite(amount)) weeklyTotalFc += amount;
      cursor.setDate(cursor.getDate() + 1);
    }

    const entry = {
      start: isoDate(start),
      end: isoDate(end),
      weeklyTotalFc,
      weeklyTargetFc,
      weeklyDeductionTargetFc,
    };
    const deductionAmount = Number(
      options.computeDeductionUsd(weeklyTotalFc, weeklyDeductionTargetFc)
    );
    if (deductionAmount > 0) {
      deductions.push({ ...entry, amount: deductionAmount });
      continue;
    }

    const bonusAmount = Number(
      options.computeBonusUsd(weeklyTotalFc, weeklyTargetFc)
    );
    if (bonusAmount > 0) bonuses.push({ ...entry, amount: bonusAmount });
  }

  return { deductions, bonuses };
}

export function usesAttendanceOnlyPayroll(role?: string | null): boolean {
  const normalized = (role || '').trim().toLowerCase();
  return (
    normalized.includes('auditr') ||
    normalized.includes('investig') ||
    normalized.includes('region')
  );
}
