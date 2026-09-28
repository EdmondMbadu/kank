import { Employee } from '../../models/employee';
import { EmployeePaymentSummary, PaymentLine, paymentNumber } from './employee-payment-summary';

export interface EmployeeBonusSummary extends Pick<EmployeePaymentSummary, 'name' | 'period' | 'net' | 'incomes' | 'note'> {
  kind: 'bonus';
}

export interface EmployeeBonusSummaryInput {
  employee: Employee;
  month: number;
  year: number;
  net: number;
  performance: number;
  percentage: number;
  team: number;
  employeeAward: number;
  manager: number;
  note: string;
}

const finite = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;

/** Present the existing bonus draft without changing amounts or recalculating awards. */
export function buildEmployeeBonusSummary(input: EmployeeBonusSummaryInput): EmployeeBonusSummary {
  const percentage = finite(input.percentage);
  const incomes: PaymentLine[] = [
    { label: percentage ? `Performance · ${paymentNumber(percentage)} %` : 'Performance', amount: finite(input.performance) },
    { label: 'Meilleure équipe', amount: finite(input.team) },
    { label: 'Meilleur employé', amount: finite(input.employeeAward) },
    { label: 'Meilleur manager', amount: finite(input.manager) },
  ].filter(row => row.amount !== 0);

  return {
    kind: 'bonus',
    name: [input.employee.firstName, input.employee.lastName].filter(Boolean).join(' '),
    period: new Date(input.year, input.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    net: finite(input.net),
    incomes,
    note: input.note.trim(),
  };
}
