import { TutorialComponent } from './tutorial.component';
import { BehaviorSubject, of } from 'rxjs';

describe('TutorialComponent performance budget', () => {
  function setup(isAdmin = true) {
    const proportion = new BehaviorSubject(50);
    const auth = {
      isAdmin, currentUser: { startingBudget: '200000' },
      performanceBudgetProportion$: proportion.asObservable(),
      updatePerformanceBudgetProportion: jasmine.createSpy('save').and.resolveTo(),
      weeklyPaymentTarget$: of(600000),
      weeklyObjectiveDeductionConfig$: of({ bandFc: 100000, penaltyPerBandUsd: 1, bonusBandFc: 100000, bonusPerBandUsd: 1 }),
    } as any;
    const compute = { computeWeeklyObjectiveDeductionUsd: () => 0 } as any;
    const component = new TutorialComponent(auth, compute);
    component.ngOnInit();
    return { component, auth, proportion };
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
});
