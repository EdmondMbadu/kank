import { of } from 'rxjs';
import { resolveWeeklyPaymentTargetForDate } from 'src/app/utils/weekly-payment-target.util';

import { EmployeePageComponent } from './employee-page.component';

describe('EmployeePageComponent', () => {
  function createComponent(authOverrides: Record<string, any> = {}) {
    const auth: any = {
      currentUser: {
        dailyReimbursement: {},
        weeklyPaymentTargetFc: 600000,
      },
      weeklyPaymentTargetFc: 600000,
      weeklyPaymentTarget$: of(600000),
      ...authOverrides,
    };

    auth.resolveWeeklyPaymentTargetForDate =
      auth.resolveWeeklyPaymentTargetForDate ||
      ((dateKey: string, user: any) =>
        resolveWeeklyPaymentTargetForDate({
          dateInput: dateKey,
          userPeriods: user?.weeklyPaymentTargetPeriods,
          userFallbackTargetFc: user?.weeklyPaymentTargetFc,
          globalPeriods: auth.weeklyPaymentTargetPeriods || [],
          globalFallbackTargetFc: auth.weeklyPaymentTargetFc,
          defaultTargetFc: 600000,
        }));

    const time = {
      yearsList: [2026],
      todaysDateMonthDayYear: () => '3-28-2026',
      convertDateToDayMonthYear: () => '28 Mars 2026',
      getTodaysDateYearMonthDay: () => '2026-03-28',
      toDate: (dateKey: string) => {
        const [month, day, year] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day);
      },
    } as any;

    const compute = {
      getMonthNameFrench: (month: number) =>
        [
          'Janvier',
          'Février',
          'Mars',
          'Avril',
          'Mai',
          'Juin',
          'Juillet',
          'Août',
          'Septembre',
          'Octobre',
          'Novembre',
          'Décembre',
        ][month - 1],
      computeWeeklyObjectiveDeductionUsd: () => 5,
    } as any;

    return new EmployeePageComponent(
      {} as any,
      {} as any,
      auth,
      time,
      compute,
      {} as any,
      {
        snapshot: {
          paramMap: {
            get: () => '1',
          },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any
    );
  }

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 2, 28));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('skips the carryover week that ends on the first Sunday of the month', () => {
    const component = createComponent({
      currentUser: {
        dailyReimbursement: {
          '2-23-2026': 10000,
          '2-24-2026': 10000,
          '2-25-2026': 10000,
          '2-26-2026': 10000,
          '2-27-2026': 10000,
          '2-28-2026': 10000,
          '3-1-2026': 10000,
          '3-2-2026': 10000,
          '3-3-2026': 10000,
          '3-4-2026': 10000,
          '3-5-2026': 10000,
          '3-6-2026': 10000,
          '3-7-2026': 10000,
          '3-8-2026': 10000,
        },
        weeklyPaymentTargetFc: 600000,
      },
    });

    const deductions = (component as any).computeWeeklyShortfallDeductions(
      3,
      2026
    );

    expect(deductions.some((d: any) => d.end === '2026-03-01')).toBeFalse();
    expect(deductions.some((d: any) => d.end === '2026-03-08')).toBeTrue();
  });

  it('filters persisted carryover deductions out of the selected month', () => {
    const component = createComponent();

    const deductions = (component as any).filterObjectiveDeductionsForMonth(
      [
        { start: '2026-02-23', end: '2026-03-01', amount: 5 },
        { start: '2026-03-02', end: '2026-03-08', amount: 5 },
      ],
      3,
      2026
    );

    expect(deductions).toEqual([
      { start: '2026-03-02', end: '2026-03-08', amount: 5 },
    ]);
  });

  it('uses the target active at the start of the week for historical deductions', () => {
    const compute = {
      getMonthNameFrench: (month: number) =>
        [
          'Janvier',
          'Février',
          'Mars',
          'Avril',
          'Mai',
          'Juin',
          'Juillet',
          'Août',
          'Septembre',
          'Octobre',
          'Novembre',
          'Décembre',
        ][month - 1],
      computeWeeklyObjectiveDeductionUsd: jasmine
        .createSpy('computeWeeklyObjectiveDeductionUsd')
        .and.returnValue(5),
    } as any;

    const auth = {
      currentUser: {
        dailyReimbursement: {
          '3-30-2026': 650000,
          '3-31-2026': 0,
          '4-1-2026': 0,
          '4-2-2026': 0,
          '4-3-2026': 0,
          '4-4-2026': 0,
          '4-5-2026': 0,
        },
        weeklyPaymentTargetFc: 900000,
      },
      weeklyPaymentTargetFc: 900000,
      weeklyPaymentTargetPeriods: [
        {
          startDateIso: '2026-01-01',
          endDateIso: '2026-03-31',
          targetFc: 600000,
        },
      ],
      weeklyPaymentTarget$: of(900000),
      resolveWeeklyPaymentTargetForDate: (dateKey: string, user: any) =>
        resolveWeeklyPaymentTargetForDate({
          dateInput: dateKey,
          userPeriods: user?.weeklyPaymentTargetPeriods,
          userFallbackTargetFc: user?.weeklyPaymentTargetFc,
          globalPeriods: auth.weeklyPaymentTargetPeriods,
          globalFallbackTargetFc: auth.weeklyPaymentTargetFc,
          defaultTargetFc: 600000,
        }),
    } as any;

    const time = {
      yearsList: [2026],
      todaysDateMonthDayYear: () => '4-20-2026',
      convertDateToDayMonthYear: () => '20 Avril 2026',
      getTodaysDateYearMonthDay: () => '2026-04-20',
      toDate: (dateKey: string) => {
        const [month, day, year] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day);
      },
    } as any;

    const component = new EmployeePageComponent(
      {} as any,
      {} as any,
      auth,
      time,
      compute,
      {} as any,
      {
        snapshot: {
          paramMap: {
            get: () => '1',
          },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any
    );

    const deductions = (component as any).computeWeeklyShortfallDeductions(
      4,
      2026
    );

    expect(deductions).toEqual([]);
    expect(compute.computeWeeklyObjectiveDeductionUsd).not.toHaveBeenCalled();
  });
});
