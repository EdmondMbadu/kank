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

  it('computes the foundation balance from completed months and employee-of-the-month trophies', () => {
    const component = createComponent({ isAdmninistrator: true });

    component.employee = {
      firstName: 'Edmond',
      dateJoined: '3-15-2025',
      bestEmployeeTrophies: [
        { month: '5', year: '2025' },
        { month: '9', year: '2025' },
        { month: '1', year: '2026' },
      ],
    };

    expect(component.foundationMonthsEarned).toBe(12);
    expect(component.foundationEmployeeOfMonthCount).toBe(3);
    expect(component.foundationMonthlyContributionTotalUsd).toBe(120);
    expect(component.foundationPerformanceBonusTotalUsd).toBe(30);
    expect(component.foundationTotalUsd).toBe(150);
    expect(component.foundationWithdrawalEligible).toBeTrue();
    expect(component.foundationWithdrawableUsd).toBe(50);
  });

  it('keeps foundation withdrawals blocked before one year of service', () => {
    const component = createComponent({ isAdmninistrator: true });

    component.employee = {
      firstName: 'Noella',
      dateJoined: '10-1-2025',
      bestEmployeeTrophies: [{ month: '2', year: '2026' }],
    };

    expect(component.foundationMonthsEarned).toBe(5);
    expect(component.foundationTotalUsd).toBe(60);
    expect(component.foundationWithdrawalEligible).toBeFalse();
    expect(component.foundationWithdrawableUsd).toBe(0);
  });

  it('deducts retranched months from foundation tenure and monthly balance', () => {
    const component = createComponent({ isAdmninistrator: true });

    component.employee = {
      firstName: 'Edmond',
      dateJoined: '3-15-2025',
      bestEmployeeTrophies: [{ month: '1', year: '2026' }],
      foundationMonthDeductions: [
        {
          id: 'ded-1',
          month: 2,
          year: 2026,
          reason: 'Absence prolongée',
          amountUsd: 10,
          status: 'active',
          createdAt: Date.now(),
        },
        {
          id: 'ded-2',
          month: 1,
          year: 2026,
          reason: 'Mois non comptabilisé',
          amountUsd: 10,
          status: 'active',
          createdAt: Date.now(),
        },
      ],
    };

    expect(component.foundationRawMonthsEarned).toBe(12);
    expect(component.foundationDeductedMonthsCount).toBe(2);
    expect(component.foundationMonthsEarned).toBe(10);
    expect(component.foundationMonthlyContributionTotalUsd).toBe(100);
    expect(component.foundationPerformanceBonusTotalUsd).toBe(10);
    expect(component.foundationTotalUsd).toBe(110);
    expect(component.foundationWithdrawalEligible).toBeFalse();
  });

  it('ignores undone month deductions in foundation totals', () => {
    const component = createComponent({ isAdmninistrator: true });

    component.employee = {
      firstName: 'Edmond',
      dateJoined: '3-15-2025',
      foundationMonthDeductions: [
        {
          id: 'ded-1',
          month: 2,
          year: 2026,
          reason: 'Absence prolongée',
          amountUsd: 10,
          status: 'undone',
          createdAt: Date.now(),
        },
      ],
    };

    expect(component.foundationDeductedMonthsCount).toBe(0);
    expect(component.foundationMonthsEarned).toBe(12);
    expect(component.foundationMonthlyContributionTotalUsd).toBe(120);
    expect(component.foundationWithdrawalEligible).toBeTrue();
  });
});
