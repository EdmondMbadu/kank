import { TrackingCentralComponent } from './tracking-central.component';

describe('TrackingCentralComponent', () => {
  function createComponent(authOverrides: Record<string, any> = {}) {
    const auth: any = {
      isAdmin: true,
      weeklyPaymentTargetFc: 900000,
      weeklyPaymentTargetPeriods: [],
      updateWeeklyPaymentTargetPeriodsGlobal: jasmine
        .createSpy('updateWeeklyPaymentTargetPeriodsGlobal')
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
});
