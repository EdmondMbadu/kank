import { TutorialComponent } from './tutorial.component';
import { BehaviorSubject, of } from 'rxjs';
import { resolveWeeklyDeductionTargetForDate } from 'src/app/utils/weekly-deduction-target.util';
import { pointBusinessDay } from 'src/app/utils/point-performance.util';
import { parseWeeklyPaymentTargetDate, formatWeeklyPaymentTargetDateIso } from 'src/app/utils/weekly-payment-target.util';

describe('TutorialComponent performance budget', () => {
  function setup(isAdmin = true) {
    const proportion = new BehaviorSubject(50);
    const deduction = new BehaviorSubject(900000);
    const visible = new BehaviorSubject(1200000);
    const user = new BehaviorSubject<any>({ uid: 'site', startingBudget: '200000' });
    const auth = {
      isAdmin, currentUser: user.value, user$: user.asObservable(),
      performanceBudgetProportion$: proportion.asObservable(),
      updatePerformanceBudgetProportion: jasmine.createSpy('save').and.resolveTo(),
      weeklyPaymentTarget$: visible.asObservable(),
      weeklyDeductionTarget$: deduction.asObservable(),
      resolveWeeklyPaymentTargetForDate: () => visible.value,
      resolveWeeklyDeductionTargetForDate: (dateInput: string, site: any) => resolveWeeklyDeductionTargetForDate({
        dateInput, userPeriods: site?.weeklyDeductionTargetPeriods,
        versions: [{ effectiveDateIso: '2000-01-01', targetFc: deduction.value }], fallbackTargetFc: visible.value,
      }),
      updateWeeklyDeductionTargetPeriodsForCurrentUser: jasmine.createSpy('savePeriods').and.callFake(async (periods: any[]) => {
        auth.currentUser = { ...auth.currentUser, weeklyDeductionTargetPeriods: periods };
        user.next(auth.currentUser);
      }),
      updateWeeklyPaymentTargetGlobal: jasmine.createSpy('visibleGoal'),
      weeklyObjectiveDeductionConfig$: of({ bandFc: 100000, penaltyPerBandUsd: 1, bonusBandFc: 100000, bonusPerBandUsd: 1 }),
    } as any;
    const compute = { computeWeeklyObjectiveDeductionUsd: (total: number, target: number) =>
      Math.max(0, Math.ceil((target - total) / 100000)) } as any;
    const component = new TutorialComponent(auth, compute);
    component.ngOnInit();
    return { component, auth, proportion, deduction, visible, user };
  }

  it('updates tiers on saved configuration without scaling the initial budget', () => {
    const { component, proportion } = setup();
    expect(component.startingBudget).toBe(200000);
    expect(component.budgetTierAmount(6000000)).toBe(3000000);
    proportion.next(25);
    expect(component.budgetTierAmount(6000000)).toBe(1500000);
    expect(component.budgetProportionInput).toBe(25);
    expect(component.startingBudget).toBe(200000);
    component.ngOnDestroy();
    proportion.next(100);
    expect(component.budgetProportionPercent).toBe(25);
  });

  it('saves valid settings only for admins', async () => {
    const { component, auth } = setup();
    component.budgetProportionInput = 25;
    await component.saveBudgetProportion();
    expect(auth.updatePerformanceBudgetProportion).toHaveBeenCalledOnceWith(25);
    expect(component.budgetTierAmount(6000000)).toBe(1500000);
    component.ngOnDestroy();
    const staff = setup(false);
    await staff.component.saveBudgetProportion();
    expect(staff.auth.updatePerformanceBudgetProportion).not.toHaveBeenCalled();
    staff.component.ngOnDestroy();
  });

  it('rejects empty/out-of-range settings and preserves displayed values on a failed save', async () => {
    const { component, auth } = setup();
    for (const value of [null, -1, 101, NaN]) {
      component.budgetProportionInput = value;
      await component.saveBudgetProportion();
    }
    expect(auth.updatePerformanceBudgetProportion).not.toHaveBeenCalled();
    component.budgetProportionInput = 25;
    auth.updatePerformanceBudgetProportion.and.rejectWith(new Error('permission-denied'));
    await component.saveBudgetProportion();
    expect(component.budgetProportionPercent).toBe(50);
    expect(component.budgetProportionSaving).toBeFalse();
    component.ngOnDestroy();
  });

  it('uses the payroll minimum for deductions while bonuses retain the visible goal', () => {
    const { component, deduction, visible } = setup();
    expect(component.weeklyMinimumFc).toBe(900000);
    expect(component.weeklyDeductionGuide.length).toBe(10);
    expect(component.weeklyDeductionGuide[0].deductionUsd).toBe(0);
    expect(component.weeklyDeductionGuide[1].deductionUsd).toBe(1);
    expect(component.weeklyDeductionGuide[9].deductionUsd).toBe(9);
    expect(component.teamWeeklyBonusThresholdFc).toBe(1200000);
    deduction.next(800000);
    expect(component.weeklyMinimumFc).toBe(800000);
    visible.next(1500000);
    expect(component.weeklyMinimumFc).toBe(800000);
    expect(component.teamWeeklyBonusThresholdFc).toBe(1500000);
    component.ngOnDestroy();
  });

  it('saves a site/week-only exception and can return to the central minimum', async () => {
    const { component, auth } = setup();
    spyOn(window, 'alert');
    component.weeklyMinimumInput = '700000';
    await component.saveWeeklyMinimum();
    const periods = auth.updateWeeklyDeductionTargetPeriodsForCurrentUser.calls.mostRecent().args[0];
    expect(periods.length).toBe(1);
    expect(periods[0].targetFc).toBe(700000);
    const start = parseWeeklyPaymentTargetDate(periods[0].startDateIso)!;
    const end = parseWeeklyPaymentTargetDate(periods[0].endDateIso)!;
    expect(start.getDay()).toBe(1);
    expect(end.getDay()).toBe(0);
    const today = formatWeeklyPaymentTargetDateIso(parseWeeklyPaymentTargetDate(pointBusinessDay())!);
    expect(periods[0].startDateIso <= today && periods[0].endDateIso >= today).toBeTrue();
    expect(component.weeklyMinimumFc).toBe(700000);
    expect(component.weeklyMinimumHasSiteOverride).toBeTrue();
    expect(auth.updateWeeklyPaymentTargetGlobal).not.toHaveBeenCalled();
    expect(component.teamWeeklyBonusThresholdFc).toBe(1200000);
    await component.useDefaultWeeklyMinimum();
    expect(component.weeklyMinimumFc).toBe(900000);
    expect(component.weeklyMinimumHasSiteOverride).toBeFalse();
    component.ngOnDestroy();
  });
});
