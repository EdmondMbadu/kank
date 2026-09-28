import { Employee, WeeklyObjectiveDeduction } from '../../models/employee';
import {
  computeMonthlyPayrollAttendanceDeductions,
  MonthlyPayrollPaymentInput,
  usesAttendanceOnlyPayroll,
} from '../../utils/monthly-payroll.util';

export interface PaymentLine {
  label: string;
  detailLabel?: string;
  amount: number;
  note?: string;
  calculation?: string;
  icon?: 'clock' | 'team' | 'attendance' | 'manual';
}

export interface PaymentWeek {
  label: string;
  amount: number;
  collected: number | null;
  target: number | null;
}

export interface EmployeePaymentSummary {
  name: string;
  period: string;
  net: number;
  incomes: PaymentLine[];
  deductions: PaymentLine[];
  deductionTotal: number;
  withoutDeductions: number;
  weeks: PaymentWeek[];
  bonusWeeks: PaymentWeek[];
  commonMinimum: number | null;
  deductionRule: { bandFc: number; penaltyPerBandUsd: number } | null;
  note: string;
}

export interface EmployeePaymentSummaryInput extends MonthlyPayrollPaymentInput {
  employee: Employee;
  month: number;
  year: number;
  yearsAtCompany: number;
  net: number;
  weeks: WeeklyObjectiveDeduction[];
  bonusWeeks: WeeklyObjectiveDeduction[];
  additionReason: string;
  withdrawalReason: string;
  note: string;
  deductionRule: EmployeePaymentSummary['deductionRule'];
}

const moneyFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export const paymentNumber = (value: number): string => moneyFormatter.format(value);
const finite = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const positive = (value: unknown): number => Math.max(0, finite(value));
const optionalAmount = (value: unknown): number | null =>
  value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0
    ? Number(value) : null;
const sameAmount = (left: number, right: number): boolean => Math.abs(left - right) < 0.005;

function weekLabel(week: WeeklyObjectiveDeduction): string {
  const start = new Date(`${week.start}T12:00:00`);
  const end = new Date(`${week.end}T12:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return [week.start, week.end].filter(Boolean).join(' – ');
  }
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (start.getFullYear() !== end.getFullYear()) options.year = 'numeric';
  return `${start.toLocaleDateString('fr-FR', options)} – ${end.toLocaleDateString('fr-FR', options)}`;
}

function displayWeeks(weeks: WeeklyObjectiveDeduction[], bonus = false): PaymentWeek[] {
  return weeks.filter(week => positive(week.amount) > 0).map(week => {
    // Use the saved payroll threshold, not the higher public bonus objective.
    const target = optionalAmount(bonus ? week.weeklyTargetFc : week.weeklyDeductionTargetFc);
    return {
      label: weekLabel(week), amount: positive(week.amount),
      collected: optionalAmount(week.weeklyTotalFc),
      target: target !== null && target > 0 ? target : null,
    };
  });
}

/** Read-only presentation of the existing draft; never recalculates or saves payroll. */
export function buildEmployeePaymentSummary(input: EmployeePaymentSummaryInput): EmployeePaymentSummary {
  const incomes: PaymentLine[] = [];
  const deductions: PaymentLine[] = [];
  const attendanceOnly = usesAttendanceOnlyPayroll(input.employee.role);
  const weeks = attendanceOnly ? [] : displayWeeks(input.weeks);
  const bonusWeeks = attendanceOnly ? [] : displayWeeks(input.bonusWeeks, true);
  const attendance = computeMonthlyPayrollAttendanceDeductions(input.employee.attendance, input.month, input.year);
  const income = (label: string, amount: number, note?: string) => {
    if (finite(amount) !== 0) incomes.push({ label, amount: finite(amount), note });
  };
  income('Salaire de base', input.base);
  const years = Math.max(0, Math.floor(finite(input.yearsAtCompany)));
  income(`Ancienneté · ${years} ${years === 1 ? 'an' : 'ans'}`, input.experience);
  income('Frais de virement', input.bankFee);
  income('Ajout', positive(input.manualAddition), input.additionReason.trim());
  if (!attendanceOnly) income('Bonus objectif semaine', positive(input.objectiveBonus));

  const attendanceLine = (label: string, singular: string, amount: number, expected: number, rate: number, icon: PaymentLine['icon']) => {
    if (positive(amount) === 0) return;
    // Admin overrides can differ from attendance. Never invent a count from a dollar amount.
    const count = expected / rate;
    const matches = count > 0 && sameAmount(amount, expected);
    deductions.push({
      label: matches ? `${count} ${count === 1 ? singular : label.toLowerCase()}` : label,
      detailLabel: label,
      amount: positive(amount), icon,
      calculation: matches ? `${count} × ${paymentNumber(rate)} $` : undefined,
    });
  };
  attendanceLine('Retards', 'retard', input.late, attendance.late, 1, 'clock');
  attendanceLine('Absences', 'absence', input.absent, attendance.absent, 3, 'attendance');
  attendanceLine('Jours marqués « néant »', 'jour marqué « néant »', input.nothing, attendance.nothing, 3, 'attendance');
  if (!attendanceOnly && positive(input.objectiveDeduction) > 0) {
    const matches = weeks.length > 0 && sameAmount(weeks.reduce((sum, week) => sum + week.amount, 0), input.objectiveDeduction);
    deductions.push({
      label: matches ? `${weeks.length} objectif${weeks.length > 1 ? 's' : ''} d’équipe non atteint${weeks.length > 1 ? 's' : ''}` : 'Objectifs d’équipe non atteints',
      amount: positive(input.objectiveDeduction), icon: 'team',
    });
  }
  if (positive(input.manualWithdrawal) > 0) deductions.push({
    label: 'Retrait', amount: positive(input.manualWithdrawal),
    note: input.withdrawalReason.trim(), icon: 'manual',
  });

  const deductionTotal = deductions.reduce((sum, row) => sum + row.amount, 0);
  const commonMinimum = weeks.length && weeks[0].target !== null && weeks.every(week => week.target === weeks[0].target)
    ? weeks[0].target : null;
  const rule = input.deductionRule;
  // Historical/manual amounts may not follow today's settings. Only explain a
  // numeric rule when it actually reproduces every recorded weekly deduction.
  const ruleMatches = rule && rule.bandFc > 0 && rule.penaltyPerBandUsd > 0 && weeks.length > 0 && weeks.every(week =>
    week.target !== null && week.collected !== null && week.collected < week.target &&
    sameAmount(Math.ceil((week.target - week.collected) / rule.bandFc) * rule.penaltyPerBandUsd, week.amount)
  );
  return {
    name: [input.employee.firstName, input.employee.lastName].filter(Boolean).join(' '),
    period: new Date(input.year, input.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    net: finite(input.net), incomes, deductions, deductionTotal,
    withoutDeductions: finite(input.net) + deductionTotal,
    weeks, bonusWeeks, commonMinimum, deductionRule: ruleMatches ? rule : null,
    note: input.note.trim(),
  };
}
