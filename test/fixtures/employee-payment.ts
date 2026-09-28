import { EmployeePaymentSummaryInput } from '../../src/app/shrink/employee-payment-dialog/employee-payment-summary';

export function paymentFixture(overrides: Partial<EmployeePaymentSummaryInput> = {}): EmployeePaymentSummaryInput {
  return {
    employee: { firstName: 'Edmond', lastName: 'Mbadu', role: 'Agent Marketing', attendance: { '9-2-2026': 'L', '9-8-2026': 'L' } },
    month: 9, year: 2026, yearsAtCompany: 1, net: 89,
    base: 100, experience: 10, bankFee: 8, manualAddition: 0, objectiveBonus: 0,
    absent: 0, nothing: 0, late: 2, objectiveDeduction: 27, manualWithdrawal: 0,
    weeks: [
      { start: '2026-08-31', end: '2026-09-06', amount: 9, weeklyTotalFc: 34000, weeklyTargetFc: 1200000, weeklyDeductionTargetFc: 900000 },
      { start: '2026-09-07', end: '2026-09-13', amount: 9, weeklyTotalFc: 75000, weeklyTargetFc: 1200000, weeklyDeductionTargetFc: 900000 },
      { start: '2026-09-14', end: '2026-09-20', amount: 9, weeklyTotalFc: 98000, weeklyTargetFc: 1200000, weeklyDeductionTargetFc: 900000 },
    ],
    bonusWeeks: [], additionReason: '', withdrawalReason: '', note: '',
    deductionRule: { bandFc: 100000, penaltyPerBandUsd: 1 }, ...overrides,
  };
}

