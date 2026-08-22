import { TrackingCentralComponent } from './tracking-central.component';

describe('TrackingCentralComponent', () => {
  function createComponent(
    authOverrides: Record<string, any> = {},
    computeOverrides: Record<string, any> = {}
  ) {
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
      ...computeOverrides,
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

  it('previews bonuses, the neutral zone, and deductions in one payroll scale', () => {
    const { component } = createComponent();
    component.weeklyPaymentTargetFc = 1200000;
    component.weeklyDeductionTargetFc = 900000;
    component.weeklyObjectiveDeductionConfig = {
      bandFc: 100000,
      penaltyPerBandUsd: 1,
      bonusBandFc: 100000,
      bonusPerBandUsd: 1,
    };

    const rows = component.weeklyAdjustmentPreviewRows;

    expect(rows[0]).toEqual(
      jasmine.objectContaining({
        label: '1 600 000 - 1 699 999 FC',
        adjustmentUsd: 5,
        kind: 'bonus',
        note: 'Continue sans plafond',
      })
    );
    expect(rows).toContain(
      jasmine.objectContaining({
        label: '900 000 - 1 199 999 FC',
        adjustmentUsd: 0,
        kind: 'neutral',
      })
    );
    expect(rows[rows.length - 1]).toEqual(
      jasmine.objectContaining({
        label: '0 - 99 999 FC',
        adjustmentUsd: -9,
        kind: 'deduction',
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

  it('calculates correct central totals without letting missing or negative legacy values corrupt them', () => {
    const legacyTotalSpy = jasmine.createSpy('findTotalAllUsersGivenField');
    const { component } = createComponent({}, {
      findTotalAllUsersGivenField: legacyTotalSpy,
      convertUsDollarsToCongoleseFranc: (value: string) =>
        (Number(value) * 2500).toString(),
      convertCongoleseFrancToUsDollars: (value: string) =>
        (Number(value) / 2500).toString(),
    });
    component.allUsers = [
      {
        clientsSavings: '20000',
        expensesAmount: '5000',
        reserveAmountDollar: '10',
        moneyInHands: '-1000',
        amountInvested: '100000',
        totalDebtLeft: '130000',
        cardsMoney: '5000',
      } as any,
      {
        clientsSavings: '-11500',
        moneyInHands: '2000',
        totalDebtLeft: '20,000',
      } as any,
      {
        clientsSavings: '30,000',
        expensesAmount: '2 500 FC',
        reserveAmountDollar: '5',
        moneyInHands: 'invalid',
        amountInvested: '50000',
        totalDebtLeft: '-5000',
        cardsMoney: '1000',
      } as any,
    ];

    component.initalizeInputs();

    expect(component.summaryContent).toEqual([
      50000,
      7500,
      37500,
      7000,
      0,
    ]);
    expect(component.valuesConvertedToDollars).toEqual([20, 3, 15, 2.8, 0]);
    expect(legacyTotalSpy).not.toHaveBeenCalled();
  });

  it('prefers the authoritative computed savings aggregate', () => {
    const { component } = createComponent({}, {
      convertCongoleseFrancToUsDollars: (value: string) => value,
    });
    component.allUsers = [
      {
        clientsSavings: '-11500',
        clientsSavingsComputed: 303500,
      } as any,
    ];

    component.initalizeInputs();

    expect(component.summaryContent[0]).toBe(303500);
    expect(component.valuesConvertedToDollars[0]).toBe(303500);
  });
});
