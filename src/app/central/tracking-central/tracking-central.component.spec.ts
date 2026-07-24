import { TrackingCentralComponent } from './tracking-central.component';

describe('TrackingCentralComponent', () => {
  function createComponent(authOverrides: Record<string, any> = {}) {
    const auth: any = {
      isAdmin: true,
      weeklyPaymentTargetFc: 900000,
      weeklyPaymentTargetPeriods: [],
      weeklyPaymentTarget$: { subscribe: () => {} },
      weeklyPaymentTargetPeriods$: { subscribe: () => {} },
      weeklyDeductionTarget$: { subscribe: () => {} },
      weeklyDeductionTargetVersions$: { subscribe: () => {} },
      teamWeeklyBonusConfig$: { subscribe: () => {} },
      profitabilityConfig$: { subscribe: () => {} },
      weeklyPaymentProjection$: { subscribe: () => {} },
      weeklyObjectiveDeductionConfig$: { subscribe: () => {} },
      updateWeeklyPaymentTargetPeriodsGlobal: jasmine
        .createSpy('updateWeeklyPaymentTargetPeriodsGlobal')
        .and.returnValue(Promise.resolve()),
      updateWeeklyPaymentTargetGlobal: jasmine
        .createSpy('updateWeeklyPaymentTargetGlobal')
        .and.returnValue(Promise.resolve()),
      updateWeeklyDeductionTargetVersionsGlobal: jasmine
        .createSpy('updateWeeklyDeductionTargetVersionsGlobal')
        .and.returnValue(Promise.resolve()),
      clearWeeklyPaymentTargetOverridesForUsers: jasmine
        .createSpy('clearWeeklyPaymentTargetOverridesForUsers')
        .and.returnValue(Promise.resolve()),
      ...authOverrides,
    };

    const time = {
      todaysDateMonthDayYear: () => '4-7-2026',
    } as any;

    const compute = {
      findTotalAllUsersGivenField: () => 0,
      convertUsDollarsToCongoleseFranc: () => '0',
      convertCongoleseFrancToUsDollars: () => '0',
    } as any;

    const component = new TrackingCentralComponent(
      {} as any,
      auth,
      time,
      compute
    );

    return { component, auth };
  }

  it('saves a new global weekly minimum period with normalized dates', async () => {
    const updateSpy = jasmine
      .createSpy('updateWeeklyPaymentTargetPeriodsGlobal')
      .and.returnValue(Promise.resolve());
    const { component } = createComponent({
      weeklyPaymentTargetPeriods: [
        {
          startDateIso: '2026-01-01',
          endDateIso: '2026-03-31',
          targetFc: 600000,
        },
      ],
      updateWeeklyPaymentTargetPeriodsGlobal: updateSpy,
    });
    component.weeklyPaymentTargetPeriods = [
      {
        startDateIso: '2026-01-01',
        endDateIso: '2026-03-31',
        targetFc: 600000,
      },
    ];

    component.weeklyPaymentTargetPeriodStartDateInput = '2026-04-01';
    component.weeklyPaymentTargetPeriodEndDateInput = '2026-06-30';
    component.weeklyPaymentTargetPeriodAmountInput = '900000';

    await component.saveWeeklyPaymentTargetPeriodGlobal();

    expect(updateSpy).toHaveBeenCalledWith([
      {
        startDateIso: '2026-01-01',
        endDateIso: '2026-03-31',
        targetFc: 600000,
      },
      {
        startDateIso: '2026-04-01',
        endDateIso: '2026-06-30',
        targetFc: 900000,
      },
    ]);
    expect(component.weeklyPaymentTargetPeriodsSaved).toBeTrue();
    expect(component.weeklyPaymentTargetPeriodStartDateInput).toBe('');
    expect(component.weeklyPaymentTargetPeriodEndDateInput).toBe('');
    expect(component.weeklyPaymentTargetPeriodAmountInput).toBe('');
  });

  it('rejects overlapping global weekly minimum periods', () => {
    const updateSpy = jasmine
      .createSpy('updateWeeklyPaymentTargetPeriodsGlobal')
      .and.returnValue(Promise.resolve());
    const { component } = createComponent({
      weeklyPaymentTargetPeriods: [
        {
          startDateIso: '2026-01-01',
          endDateIso: '2026-03-31',
          targetFc: 600000,
        },
      ],
      updateWeeklyPaymentTargetPeriodsGlobal: updateSpy,
    });
    component.weeklyPaymentTargetPeriods = [
      {
        startDateIso: '2026-01-01',
        endDateIso: '2026-03-31',
        targetFc: 600000,
      },
    ];
    spyOn(window, 'alert');

    component.weeklyPaymentTargetPeriodStartDateInput = '2026-03-15';
    component.weeklyPaymentTargetPeriodEndDateInput = '2026-04-30';
    component.weeklyPaymentTargetPeriodAmountInput = '900000';

    component.saveWeeklyPaymentTargetPeriodGlobal();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(
      'Ces périodes se chevauchent. Corrigez les dates pour garder des intervalles distincts.'
    );
  });

  it('global weekly minimum save clears dated and user-specific minimum rules', async () => {
    const updateGlobal = jasmine
      .createSpy('updateWeeklyPaymentTargetGlobal')
      .and.returnValue(Promise.resolve());
    const clearUserOverrides = jasmine
      .createSpy('clearWeeklyPaymentTargetOverridesForUsers')
      .and.returnValue(Promise.resolve());
    const { component } = createComponent({
      updateWeeklyPaymentTargetGlobal: updateGlobal,
      clearWeeklyPaymentTargetOverridesForUsers: clearUserOverrides,
    });
    component.allUsers = [
      { uid: 'site-1', weeklyPaymentTargetFc: '900000' } as any,
      { uid: 'site-2', weeklyPaymentTargetPeriods: [] } as any,
    ];
    component.weeklyPaymentTargetPeriods = [
      {
        startDateIso: '2026-05-01',
        endDateIso: '2026-06-27',
        targetFc: 900000,
      },
    ];
    component.projectedWeeklyPaymentTargetFc = 1200000;
    component.projectedWeeklyPaymentEffectiveDate = '2026-07-01';
    component.projectedWeeklyPaymentVisible = true;
    component.weeklyPaymentTargetInput = '1200000';

    component.saveWeeklyPaymentTargetGlobal();
    await Promise.resolve();
    await Promise.resolve();

    expect(updateGlobal).toHaveBeenCalledWith(1200000);
    expect(clearUserOverrides).toHaveBeenCalledWith(['site-1', 'site-2']);
    expect(component.weeklyPaymentTargetPeriods).toEqual([]);
    expect(component.projectedWeeklyPaymentTargetFc).toBeNull();
    expect(component.projectedWeeklyPaymentEffectiveDate).toBe('');
    expect(component.projectedWeeklyPaymentVisible).toBeFalse();
  });

  it('previews one uniform payroll deduction per missing tranche down to zero', () => {
    const { component } = createComponent();
    component.weeklyPaymentTargetFc = 1200000;
    component.weeklyDeductionTargetFc = 900000;
    component.weeklyObjectiveDeductionConfig = {
      bandFc: 100000,
      penaltyPerBandUsd: 1,
    };

    const rows = component.weeklyDeductionPreviewRows;

    expect(rows[0]).toEqual(
      jasmine.objectContaining({
        label: '900 000 FC ou plus',
        deductionUsd: 0,
      })
    );
    expect(rows[1]).toEqual(
      jasmine.objectContaining({
        label: '800 000 - 899 999 FC',
        deductionUsd: 1,
      })
    );
    expect(rows[rows.length - 1]).toEqual(
      jasmine.objectContaining({
        label: '0 - 99 999 FC',
        deductionUsd: 9,
      })
    );
  });

  it('saves a monday-effective payroll threshold without changing the visible target', async () => {
    const updateSpy = jasmine
      .createSpy('updateWeeklyDeductionTargetVersionsGlobal')
      .and.returnValue(Promise.resolve());
    const { component } = createComponent({
      updateWeeklyDeductionTargetVersionsGlobal: updateSpy,
    });
    component.weeklyPaymentTargetFc = 1200000;
    component.weeklyDeductionTargetVersions = [];
    component.weeklyDeductionTargetAmountInput = '900000';
    component.weeklyDeductionTargetEffectiveDateInput = '2026-07-20';

    component.saveWeeklyDeductionTargetVersionGlobal();
    await Promise.resolve();
    await Promise.resolve();

    expect(updateSpy).toHaveBeenCalledWith([
      { effectiveDateIso: '2026-07-20', targetFc: 900000 },
    ]);
    expect(component.weeklyPaymentTargetFc).toBe(1200000);
    expect(component.weeklyDeductionTargetSaved).toBeTrue();
  });

  it('rejects a payroll threshold effective date that is not monday', () => {
    const { component, auth } = createComponent();
    spyOn(window, 'alert');
    component.weeklyDeductionTargetAmountInput = '900000';
    component.weeklyDeductionTargetEffectiveDateInput = '2026-07-23';

    component.saveWeeklyDeductionTargetVersionGlobal();

    expect(
      auth.updateWeeklyDeductionTargetVersionsGlobal
    ).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(
      'La date effective doit être un lundi.'
    );
  });
});
