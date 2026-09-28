import { buildEmployeePaymentSummary } from './employee-payment-summary';
import { paymentFixture } from '../../../../test/fixtures/employee-payment';

describe('Employee payment presentation', () => {
  it('keeps the recorded payout distinct from the same-month hypothetical, without mutating the draft', () => {
    const input = paymentFixture();
    const before = JSON.stringify(input);
    const view = buildEmployeePaymentSummary(input);
    expect(view.net).toBe(89);
    expect(view.withoutDeductions).toBe(118);
    expect(view.deductionTotal).toBe(29);
    expect(view.deductions.map(row => row.label)).toEqual(['2 retards', '3 objectifs d’équipe non atteints']);
    expect(view.commonMinimum).toBe(900000);
    expect(view.deductionRule?.penaltyPerBandUsd).toBe(1);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('shows no deductions while retaining earned bonuses and additions in the actual payout', () => {
    const view = buildEmployeePaymentSummary(paymentFixture({ net: 126, late: 0, objectiveDeduction: 0, weeks: [], objectiveBonus: 3, manualAddition: 5, additionReason: 'Prime ponctuelle' }));
    expect(view.deductions).toEqual([]);
    expect(view.withoutDeductions).toBe(126);
    expect(view.incomes.find(row => row.label === 'Ajout')?.note).toBe('Prime ponctuelle');
    expect(view.incomes.find(row => row.label === 'Bonus objectif semaine')?.amount).toBe(3);
  });

  it('does not turn overridden amounts into fictional attendance counts or a false weekly formula', () => {
    const input = paymentFixture({ late: 4, weeks: [{ start: '2026-09-07', end: '2026-09-13', amount: 7, weeklyTotalFc: 75000, weeklyDeductionTargetFc: 900000 }] });
    const view = buildEmployeePaymentSummary(input);
    expect(view.deductions[0].label).toBe('Retards');
    expect(view.deductions[0].calculation).toBeUndefined();
    expect(view.deductions[1].label).toBe('Objectifs d’équipe non atteints');
    expect(view.deductionRule).toBeNull();
  });

  it('preserves each week’s minimum when thresholds change and does not replace missing data with zero', () => {
    const view = buildEmployeePaymentSummary(paymentFixture({ weeks: [
      { start: '2026-09-07', end: '2026-09-13', amount: 2, weeklyDeductionTargetFc: 900000, weeklyTotalFc: 750000 },
      { start: '2026-09-14', end: '2026-09-20', amount: 3, weeklyDeductionTargetFc: 1200000, weeklyTotalFc: 950000 },
      { start: '2026-09-21', end: '2026-09-27', amount: 1, weeklyTargetFc: 1500000 },
    ] }));
    expect(view.commonMinimum).toBeNull();
    expect(view.weeks.map(week => week.target)).toEqual([900000, 1200000, null]);
    expect(view.weeks[2].collected).toBeNull();
    expect(view.deductionRule).toBeNull();
  });

  it('uses the configured deduction rate, not the illustrative design values', () => {
    const input = paymentFixture({ weeks: [{ start: '2026-09-07', end: '2026-09-13', amount: 4, weeklyTotalFc: 650000, weeklyDeductionTargetFc: 900000 }], deductionRule: { bandFc: 200000, penaltyPerBandUsd: 2 } });
    expect(buildEmployeePaymentSummary(input).deductionRule).toEqual(input.deductionRule);
  });

  it('keeps manual withdrawals and all attendance categories visible, including their reasons', () => {
    const view = buildEmployeePaymentSummary(paymentFixture({ absent: 3, nothing: 6, manualWithdrawal: 8.5, withdrawalReason: 'Avance', note: 'À vérifier avant signature.' }));
    expect(view.deductionTotal).toBe(46.5);
    expect(view.deductions.find(row => row.label === 'Retrait')?.note).toBe('Avance');
    expect(view.note).toBe('À vérifier avant signature.');
  });

  it('respects payroll roles that exclude collection deductions and bonuses', () => {
    const view = buildEmployeePaymentSummary(paymentFixture({ employee: { role: 'Auditrice' }, net: 116, objectiveBonus: 3 }));
    expect(view.deductionTotal).toBe(2);
    expect(view.withoutDeductions).toBe(118);
    expect(view.weeks).toEqual([]);
    expect(view.bonusWeeks).toEqual([]);
    expect(view.incomes.some(row => row.label === 'Bonus objectif semaine')).toBeFalse();
  });
});
