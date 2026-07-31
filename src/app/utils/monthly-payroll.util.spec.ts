import {
  computeMonthlyPayrollAttendanceDeductions,
  computeMonthlyPayrollObjectiveAdjustments,
  computeMonthlyPayrollPayment,
  usesAttendanceOnlyPayroll,
} from './monthly-payroll.util';

describe('monthly payroll utilities', () => {
  it('computes the same net formula used by employee and central payroll pages', () => {
    expect(
      computeMonthlyPayrollPayment({
        base: 100,
        bankFee: 5,
        experience: 10,
        manualAddition: 3,
        objectiveBonus: 2,
        absent: 3,
        nothing: 0,
        late: 1,
        objectiveDeduction: 2,
        manualWithdrawal: 4,
      })
    ).toBe(110);
  });

  it('deduplicates timestamped attendance entries before calculating deductions', () => {
    expect(
      computeMonthlyPayrollAttendanceDeductions(
        {
          '7-2-2026-08-00-00': 'A',
          '7-2-2026-09-00-00': 'P',
          '7-3-2026': 'N',
          '7-4-2026': 'L',
        },
        7,
        2026
      )
    ).toEqual({ absent: 0, nothing: 3, late: 1 });
  });

  it('uses the visible minimum for additions and the payroll minimum for deductions', () => {
    const adjustments = computeMonthlyPayrollObjectiveAdjustments({
      month: 7,
      year: 2026,
      today: new Date(2026, 6, 23),
      dailyReimbursement: {
        '6-29-2026': 1200000,
        '7-6-2026': 700000,
        '7-13-2026': 901000,
      },
      resolveVisibleTargetFc: () => 1200000,
      resolveDeductionTargetFc: () => 900000,
      computeDeductionUsd: (total, target) =>
        total < target ? Math.ceil((target - total) / 100000) : 0,
      computeBonusUsd: (total, target) =>
        total >= target ? Math.floor((total - target) / 100000) + 1 : 0,
    });

    expect(adjustments.deductions).toContain(
      jasmine.objectContaining({
        end: '2026-07-12',
        weeklyTotalFc: 700000,
        amount: 2,
      })
    );
    expect(
      adjustments.bonuses.some((item) => item.end === '2026-07-19')
    ).toBeFalse();
    expect(adjustments.bonuses).toContain(
      jasmine.objectContaining({
        end: '2026-07-05',
        weeklyTotalFc: 1200000,
        amount: 1,
      })
    );
  });

  it('applies attendance-only payroll consistently by role', () => {
    expect(usesAttendanceOnlyPayroll('Auditrice')).toBeTrue();
    expect(usesAttendanceOnlyPayroll('Investigateur')).toBeTrue();
    expect(usesAttendanceOnlyPayroll('Manager Regionale')).toBeTrue();
    expect(usesAttendanceOnlyPayroll('Agent Marketing')).toBeFalse();
  });
});
