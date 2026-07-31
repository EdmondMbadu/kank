import { of } from 'rxjs';
import { resolveWeeklyPaymentTargetForDate } from 'src/app/utils/weekly-payment-target.util';
import { computeWeeklyObjectiveAdjustment } from 'src/app/utils/weekly-objective-adjustment.util';

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
      weeklyDeductionTarget$: of(600000),
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
    auth.resolveWeeklyDeductionTargetForDate =
      auth.resolveWeeklyDeductionTargetForDate ||
      ((dateKey: string, user: any) =>
        auth.resolveWeeklyPaymentTargetForDate(dateKey, user));

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
      computeWeeklyObjectiveDeductionUsd: (
        totalFc: number,
        deductionTargetFc: number
      ) => {
        const adjustment = computeWeeklyObjectiveAdjustment(
          totalFc,
          deductionTargetFc,
          deductionTargetFc,
          {
            bandFc: 100000,
            penaltyPerBandUsd: 1,
            bonusBandFc: 100000,
            bonusPerBandUsd: 1,
          }
        );
        return adjustment.kind === 'deduction' ? adjustment.amountUsd : 0;
      },
      computeWeeklyObjectiveBonusUsd: (
        totalFc: number,
        visibleTargetFc: number
      ) => {
        const adjustment = computeWeeklyObjectiveAdjustment(
          totalFc,
          visibleTargetFc,
          visibleTargetFc,
          {
            bandFc: 100000,
            penaltyPerBandUsd: 1,
            bonusBandFc: 100000,
            bonusPerBandUsd: 1,
          }
        );
        return adjustment.kind === 'bonus' ? adjustment.amountUsd : 0;
      },
      computeWeeklyObjectiveAdjustmentUsd: (
        totalFc: number,
        deductionTargetFc: number,
        visibleTargetFc: number
      ) =>
        computeWeeklyObjectiveAdjustment(
          totalFc,
          deductionTargetFc,
          visibleTargetFc,
          {
            bandFc: 100000,
            penaltyPerBandUsd: 1,
            bonusBandFc: 100000,
            bonusPerBandUsd: 1,
          }
        ),
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

    const adjustments = (component as any).computeWeeklyObjectiveAdjustments(
      3,
      2026
    );

    expect(
      adjustments.deductions.some((d: any) => d.end === '2026-03-01')
    ).toBeFalse();
    expect(
      adjustments.deductions.some((d: any) => d.end === '2026-03-08')
    ).toBeTrue();
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
      jasmine.objectContaining({
        start: '2026-03-02',
        end: '2026-03-08',
        amount: 5,
        weeklyTargetFc: 600000,
        weeklyDeductionTargetFc: 600000,
      }),
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
        .and.callFake((totalFc: number, deductionTargetFc: number) => {
          const adjustment = computeWeeklyObjectiveAdjustment(
            totalFc,
            deductionTargetFc,
            deductionTargetFc,
            {
              bandFc: 100000,
              penaltyPerBandUsd: 1,
              bonusBandFc: 100000,
              bonusPerBandUsd: 1,
            }
          );
          return adjustment.kind === 'deduction' ? adjustment.amountUsd : 0;
        }),
      computeWeeklyObjectiveBonusUsd: jasmine
        .createSpy('computeWeeklyObjectiveBonusUsd')
        .and.callFake((totalFc: number, visibleTargetFc: number) => {
          const adjustment = computeWeeklyObjectiveAdjustment(
            totalFc,
            visibleTargetFc,
            visibleTargetFc,
            {
              bandFc: 100000,
              penaltyPerBandUsd: 1,
              bonusBandFc: 100000,
              bonusPerBandUsd: 1,
            }
          );
          return adjustment.kind === 'bonus' ? adjustment.amountUsd : 0;
        }),
      computeWeeklyObjectiveAdjustmentUsd: jasmine
        .createSpy('computeWeeklyObjectiveAdjustmentUsd')
        .and.callFake(
          (
            totalFc: number,
            deductionTargetFc: number,
            visibleTargetFc: number
          ) =>
            computeWeeklyObjectiveAdjustment(
              totalFc,
              deductionTargetFc,
              visibleTargetFc,
              {
                bandFc: 100000,
                penaltyPerBandUsd: 1,
                bonusBandFc: 100000,
                bonusPerBandUsd: 1,
              }
            )
        ),
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
      resolveWeeklyDeductionTargetForDate: (dateKey: string, user: any) =>
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

    const adjustments = (component as any).computeWeeklyObjectiveAdjustments(
      4,
      2026
    );

    expect(adjustments.deductions).toEqual([]);
    expect(adjustments.bonuses).toEqual([]);
  });

  it('uses the payroll threshold for deductions while retaining both targets', () => {
    const component = createComponent({
      currentUser: {
        dailyReimbursement: {
          '3-2-2026': 700000,
        },
        weeklyPaymentTargetFc: 1200000,
      },
      weeklyPaymentTargetFc: 1200000,
      resolveWeeklyDeductionTargetForDate: () => 900000,
    });
    const deductionSpy = spyOn(
      component.compute,
      'computeWeeklyObjectiveDeductionUsd'
    ).and.returnValue(2);
    const bonusSpy = spyOn(
      component.compute,
      'computeWeeklyObjectiveBonusUsd'
    ).and.returnValue(0);

    const adjustments = (component as any).computeWeeklyObjectiveAdjustments(
      3,
      2026
    );
    const week = adjustments.deductions.find(
      (item: any) => item.end === '2026-03-08'
    );

    expect(week).toEqual(
      jasmine.objectContaining({
        weeklyTotalFc: 700000,
        weeklyTargetFc: 1200000,
        weeklyDeductionTargetFc: 900000,
        amount: 2,
      })
    );
    expect(deductionSpy).toHaveBeenCalledWith(700000, 900000);
    expect(bonusSpy).not.toHaveBeenCalled();
  });

  it('calculates salary additions from the visible minimum, not the payroll threshold', () => {
    const component = createComponent({
      currentUser: {
        dailyReimbursement: {
          '3-2-2026': 1200000,
        },
        weeklyPaymentTargetFc: 900000,
      },
      weeklyPaymentTargetFc: 1200000,
      resolveWeeklyDeductionTargetForDate: () => 900000,
    });
    spyOn(
      component.compute,
      'computeWeeklyObjectiveDeductionUsd'
    ).and.returnValue(0);
    const bonusSpy = spyOn(
      component.compute,
      'computeWeeklyObjectiveBonusUsd'
    ).and.returnValue(1);

    const adjustments = (component as any).computeWeeklyObjectiveAdjustments(
      3,
      2026
    );
    const week = adjustments.bonuses.find(
      (item: any) => item.end === '2026-03-08'
    );

    expect(week).toEqual(
      jasmine.objectContaining({
        weeklyTotalFc: 1200000,
        weeklyTargetFc: 1200000,
        weeklyDeductionTargetFc: 900000,
        amount: 1,
      })
    );
    expect(bonusSpy).toHaveBeenCalledWith(1200000, 1200000);
  });

  it('adds completed weekly objective bonuses to salary', () => {
    const component = createComponent();
    component.paymentAmount = 100;
    component.paymentObjectiveWeekBonusTotal = 3;
    component.paymentObjectiveWeekDeductionTotal = 1;

    expect(component.computeTotalPayment()).toBe(102);
  });

  it('allows an admin to add and remove a weekly objective addition', () => {
    const component = createComponent();
    component.weekObjectiveBonusStartDate = '2026-03-02';
    component.weekObjectiveBonusEndDate = '2026-03-08';
    component.weekObjectiveBonusAmount = 4;

    component.addObjectiveWeekBonus();

    expect(component.paymentObjectiveWeekBonuses).toEqual([
      jasmine.objectContaining({
        start: '2026-03-02',
        end: '2026-03-08',
        amount: 4,
        weeklyTargetFc: 600000,
      }),
    ]);
    expect(component.paymentObjectiveWeekBonusTotal).toBe(4);
    expect(component.paymentObjectiveWeekBonusesManuallyAdjusted).toBeTrue();

    component.removeObjectiveWeekBonus(0);

    expect(component.paymentObjectiveWeekBonuses).toEqual([]);
    expect(component.paymentObjectiveWeekBonusTotal).toBe(0);
    expect(component.computeTotalPayment()).toBe(0);
  });

  it('preserves manually adjusted additions when reopening an unpaid draft', () => {
    const component = createComponent();
    component.employee = {
      paymentConfiguredMonthKey: '2026-03',
      paidPaymentThisMonth: false,
    };
    component.paymentObjectiveWeekBonuses = [
      { start: '2026-03-02', end: '2026-03-08', amount: 4 },
    ];
    component.paymentObjectiveWeekBonusesManuallyAdjusted = true;
    const computeSpy = spyOn<any>(
      component as any,
      'computeWeeklyObjectiveAdjustments'
    );

    (component as any).ensurePaymentDraftForCurrentMonth();

    expect(computeSpy).not.toHaveBeenCalled();
    expect(component.paymentObjectiveWeekBonuses).toEqual([
      jasmine.objectContaining({
        start: '2026-03-02',
        end: '2026-03-08',
        amount: 4,
      }),
    ]);
    expect(component.paymentObjectiveWeekBonusTotal).toBe(4);
  });

  it('removes a stale automatic addition below the global visible minimum', () => {
    const component = createComponent({
      currentUser: {
        dailyReimbursement: { '3-2-2026': 901000 },
        weeklyPaymentTargetFc: 900000,
      },
      weeklyPaymentTargetFc: 1200000,
    });
    component.employee = {
      paymentConfiguredMonthKey: '2026-03',
      paidPaymentThisMonth: true,
    };
    component.paymentObjectiveWeekBonuses = [
      {
        start: '2026-03-02',
        end: '2026-03-08',
        amount: 1,
        weeklyTotalFc: 901000,
        weeklyTargetFc: 900000,
      },
    ];
    component.paymentObjectiveWeekBonusesManuallyAdjusted = false;

    (component as any).ensurePaymentDraftForCurrentMonth();

    expect(component.paymentObjectiveWeekBonuses).toEqual([]);
    expect(component.paymentObjectiveWeekBonusTotal).toBe(0);
  });

  it('copies objective additions and their manual override into saved payment data', () => {
    const component = createComponent();
    component.employee = {};
    component.paymentObjectiveWeekBonuses = [
      { start: '2026-03-02', end: '2026-03-08', amount: 4 },
    ];
    component.paymentObjectiveWeekBonusTotal = 4;
    component.paymentObjectiveWeekBonusesManuallyAdjusted = true;

    component.setPaymentInfo();

    expect(component.employee.paymentObjectiveWeekBonusTotal).toBe('4');
    expect(component.employee.paymentObjectiveWeekBonuses).toEqual([
      jasmine.objectContaining({
        start: '2026-03-02',
        end: '2026-03-08',
        amount: 4,
      }),
    ]);
    expect(
      component.employee.paymentObjectiveWeekBonusesManuallyAdjusted
    ).toBeTrue();
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
