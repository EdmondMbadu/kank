import { EmployeeBonusSummaryInput } from '../../src/app/shrink/employee-payment-dialog/employee-bonus-summary';

export function bonusFixture(overrides: Partial<EmployeeBonusSummaryInput> = {}): EmployeeBonusSummaryInput {
  return {
    employee: { firstName: 'Edmond', lastName: 'Mbadu' },
    month: 8,
    year: 2026,
    net: 70,
    performance: 0,
    percentage: 0,
    team: 70,
    employeeAward: 0,
    manager: 0,
    note: '',
    ...overrides,
  };
}
