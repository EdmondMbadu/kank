import { of } from 'rxjs';
import { resolveWeeklyPaymentTargetForDate } from 'src/app/utils/weekly-payment-target.util';

import { TodayComponent } from './today.component';

describe('TodayComponent', () => {
  function createComponent(authOverrides: Record<string, any> = {}) {
    const auth: any = {
      isAdmin: true,
      currentUser: {
        uid: 'user-1',
        email: 'admin@example.com',
        firstName: 'Admin',
        teamCode: '',
        dailyReimbursement: {},
        weeklyPaymentTargetPeriods: [],
      },
      weeklyPaymentTargetFc: 900000,
      weeklyPaymentTargetPeriods: [],
      weeklyPaymentTarget$: of(900000),
      weeklyPaymentProjection$: of({
        projectedTargetFc: null,
        effectiveDateIso: '',
      }),
      getAllClients: () => of([]),
      getAllClientsCard: () => of([]),
      loadReceipts: () => Promise.resolve([]),
      updateWeeklyPaymentTargetPeriodsForCurrentUser: jasmine
        .createSpy('updateWeeklyPaymentTargetPeriodsForCurrentUser')
        .and.returnValue(Promise.resolve()),
      ...authOverrides,
    };

    auth.resolveWeeklyPaymentTargetForDate =
      auth.resolveWeeklyPaymentTargetForDate ||
      jasmine
        .createSpy('resolveWeeklyPaymentTargetForDate')
        .and.callFake((dateKey: string, user: any) =>
          resolveWeeklyPaymentTargetForDate({
            dateInput: dateKey,
            userPeriods: user?.weeklyPaymentTargetPeriods,
            userFallbackTargetFc: user?.weeklyPaymentTargetFc,
            globalPeriods: auth.weeklyPaymentTargetPeriods,
            globalFallbackTargetFc: auth.weeklyPaymentTargetFc,
            defaultTargetFc: 600000,
          })
        );

    const time = {
      todaysDateMonthDayYear: () => '4-1-2026',
      getTomorrowsDateMonthDayYear: () => '4-2-2026',
      convertDateToDayMonthYear: () => '1 Avril 2026',
      getTodaysDateYearMonthDay: () => '2026-04-01',
      convertDateToMonthDayYear: (isoDate: string) => {
        const [year, month, day] = isoDate.split('-').map(Number);
        return `${month}-${day}-${year}`;
      },
      toDate: (dateKey: string) => {
        const [month, day, year] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day);
      },
      getDayOfWeek: () => 'Wednesday',
    } as any;

    const compute = {
      convertCongoleseFrancToUsDollars: (value: string) =>
        (Number(value || 0) / 2900).toString(),
      computeWeeklyObjectiveDeductionUsd: () => 5,
    } as any;

    const component = new TodayComponent(
      {} as any,
      auth,
      time,
      compute,
      {} as any,
      {} as any,
      {} as any
    );

    return { component, auth };
  }

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 3, 20));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('uses the target active on the monday of the selected week in the summary card', () => {
    const { component, auth } = createComponent({
      currentUser: {
        uid: 'user-1',
        teamCode: '',
        dailyReimbursement: {
          '3-30-2026': 650000,
        },
        weeklyPaymentTargetPeriods: [],
      },
      weeklyPaymentTargetFc: 900000,
      weeklyPaymentTargetPeriods: [
        {
          startDateIso: '2026-01-01',
          endDateIso: '2026-03-31',
          targetFc: 600000,
        },
      ],
    });

    component.weekPickerStartDate = '2026-04-01';

    component.updateWeekPickerTotals();

    expect(auth.resolveWeeklyPaymentTargetForDate).toHaveBeenCalledWith(
      '3-30-2026',
      auth.currentUser
    );
    expect(component.weekPickerTargetFc).toBe(600000);
    expect(component.weekPickerTargetReached).toBeTrue();
  });

  it('saves a user-specific dated weekly minimum period for admins', async () => {
    const updateSpy = jasmine
      .createSpy('updateWeeklyPaymentTargetPeriodsForCurrentUser')
      .and.returnValue(Promise.resolve());
    const { component } = createComponent({
      currentUser: {
        uid: 'user-1',
        teamCode: '',
        dailyReimbursement: {},
        weeklyPaymentTargetPeriods: [
          {
            startDateIso: '2026-01-01',
            endDateIso: '2026-03-31',
            targetFc: 600000,
          },
        ],
      },
      updateWeeklyPaymentTargetPeriodsForCurrentUser: updateSpy,
    });
    spyOn(window, 'alert');
    spyOn<any>(component, 'syncWeeklyTargetFc');

    component.weeklyTargetPeriodStartDateInput = '2026-04-01';
    component.weeklyTargetPeriodEndDateInput = '2026-06-30';
    component.weeklyTargetPeriodAmountInput = '900000';

    await component.saveWeeklyTargetPeriodForUser();

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
    expect(component.weeklyTargetPeriodStartDateInput).toBe('');
    expect(component.weeklyTargetPeriodEndDateInput).toBe('');
    expect(component.weeklyTargetPeriodAmountInput).toBe('');
    expect(window.alert).toHaveBeenCalledWith('Période spécifique enregistrée');
  });

  it('stores the historical weekly target on each deduction entry', () => {
    const { component } = createComponent({
      currentUser: {
        uid: 'user-1',
        teamCode: '',
        dailyReimbursement: {
          '3-30-2026': 180000,
          '3-31-2026': 0,
          '4-1-2026': 0,
          '4-2-2026': 0,
          '4-3-2026': 0,
          '4-4-2026': 0,
          '4-5-2026': 0,
        },
        weeklyPaymentTargetPeriods: [],
      },
      weeklyPaymentTargetFc: 900000,
      weeklyPaymentTargetPeriods: [
        {
          startDateIso: '2026-01-01',
          endDateIso: '2026-03-31',
          targetFc: 600000,
        },
      ],
    });

    component.selectedShortfallMonth = '2026-04';

    (component as any).computeMonthlyWeeklyShortfalls();

    expect(component.weeklyShortfalls.length).toBeGreaterThan(0);
    expect(component.weeklyShortfalls[0].label).toContain('30 Mars - 5 Avril 2026');
    expect(component.weeklyShortfalls[0].targetFc).toBe(600000);
  });
});
