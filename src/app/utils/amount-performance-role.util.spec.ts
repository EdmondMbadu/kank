import { isAmountPerformanceRoleEligible } from './amount-performance-role.util';

describe('amount performance role eligibility', () => {
  it('allows only roles whose performance is payment-based', () => {
    expect(isAmountPerformanceRoleEligible('Manager')).toBeTrue();
    expect(isAmountPerformanceRoleEligible('Agent Marketing')).toBeTrue();
    expect(isAmountPerformanceRoleEligible('Stagaire')).toBeTrue();
    expect(isAmountPerformanceRoleEligible('Stagiaire')).toBeTrue();
  });

  it('keeps verifier and other operational roles on habitual performance', () => {
    expect(isAmountPerformanceRoleEligible('Vérificateur')).toBeFalse();
    expect(isAmountPerformanceRoleEligible('Stagaire Polyvalent')).toBeFalse();
    expect(isAmountPerformanceRoleEligible('Agent')).toBeFalse();
    expect(isAmountPerformanceRoleEligible('Polyvalent')).toBeFalse();
    expect(isAmountPerformanceRoleEligible('')).toBeFalse();
  });
});
