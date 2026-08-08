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
      monthFrenchNames: [
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
      ],
      todaysDateMonthDayYear: () => '3-28-2026',
      todaysDate: () => '3-28-2026-9-0-0',
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
      getGradientColor: () => '#22c55e',
      findColor: () => '#22c55e',
      colorPositive: '#22c55e',
      convertCongoleseFrancToUsDollars: (value: string) =>
        Math.ceil(Number(value || 0) / 2900),
    } as any;
    const performanceMetricSettings = {
      employeeMode$: of('legacy'),
      updateEmployeeMode: jasmine
        .createSpy('updateEmployeeMode')
        .and.resolveTo(),
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
      {} as any,
      performanceMetricSettings
    );
  }

  function completeOperatingDayRecords(
    month: number,
    year: number,
    throughDay: number,
    employeeUid = 'employee-1'
  ): any[] {
    const records: any[] = [];
    for (let day = 1; day <= throughDay; day++) {
      if (new Date(year, month - 1, day).getDay() === 0) continue;
      records.push({
        dayKey: `${month}-${day}-${year}`,
        total: 50,
        expected: 100,
        expectedPresent: true,
        totalPresent: true,
        employeeUid,
      });
    }
    return records;
  }

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 2, 28));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('does not activate amount performance for a non-admin', async () => {
    const component = createComponent({ isAdmninistrator: false });
    const loadSpy = spyOn<any>(component as any, 'loadAmountPerformancePreview');
    const historySpy = spyOn<any>(
      component as any,
      'loadHistoricalAmountPerformance'
    );

    await component.setPerformanceMetricMode('amount');

    expect(component.performanceMetricMode).toBe('legacy');
    expect(loadSpy).not.toHaveBeenCalled();
    expect(historySpy).not.toHaveBeenCalled();
  });

  it('uses the published amount percentage for an employee without admin mode', () => {
    const component = createComponent({ isAdmninistrator: false });
    component.employee = {
      uid: 'employee-1',
      role: 'Agent Marketing',
    };
    component.publishedEmployeePerformanceMode = 'amount';
    component.performancePercentageMonth = '40';
    component.amountPerformanceSummary = {
      percent: 64.5,
      visualPercent: 64.5,
    } as any;

    expect(component.isAmountPerformanceMode).toBeTrue();
    expect(component.isAdminUi).toBeFalse();
    expect(component.currentPerformancePercent).toBe(64.5);
    expect(component.currentPerformanceVisualPercent).toBe(64.5);
  });

  it('keeps verifier performance habitual when amount mode is selected', async () => {
    const component = createComponent({ isAdmninistrator: true });
    component.employee = {
      uid: 'verifier-1',
      role: 'Vérificateur',
    };
    component.performancePercentageMonth = '46';
    component.amountPerformanceSummary = {
      percent: 91,
      visualPercent: 91,
    } as any;
    const loadSpy = spyOn<any>(
      component as any,
      'loadAmountPerformancePreview'
    );
    const historySpy = spyOn<any>(
      component as any,
      'loadHistoricalAmountPerformance'
    );

    await component.setPerformanceMetricMode('amount');

    expect(component.performanceMetricMode).toBe('amount');
    expect(component.isAmountPerformanceMode).toBeFalse();
    expect(component.currentPerformancePercent).toBe(46);
    expect(component.currentPerformanceVisualPercent).toBe(46);
    expect(loadSpy).not.toHaveBeenCalled();
    expect(historySpy).not.toHaveBeenCalled();
  });

  it('falls back to the habitual employee percentage when amount data is unavailable', () => {
    const component = createComponent({ isAdmninistrator: false });
    component.publishedEmployeePerformanceMode = 'amount';
    component.performancePercentageMonth = '40';
    component.amountPerformanceSummary = null;

    expect(component.currentPerformancePercent).toBe(40);
    expect(component.currentPerformanceVisualPercent).toBe(40);
  });

  it('computes an individual amount preview from the already loaded month data', async () => {
    const component = createComponent({
      isAdmninistrator: true,
      currentUser: {
        uid: 'owner-1',
        dailyReimbursement: {},
        weeklyPaymentTargetFc: 600000,
      },
    });
    component.employee = {
      uid: 'employee-1',
      firstName: 'Amina',
      role: 'Agent Marketing',
    };
    component.givenMonth = 3;
    component.givenYear = 2026;
    component.monthlyDayTotals = {
      '3-27-2026': {
        dayKey: '3-27-2026',
        total: 250000,
        expected: 500000,
        expectedPresent: true,
        totalPresent: true,
        employeeUid: 'employee-1',
      },
      '3-29-2026': {
        dayKey: '3-29-2026',
        total: 900000,
        expected: 900000,
        expectedPresent: true,
        totalPresent: true,
        employeeUid: 'employee-1',
      },
    };
    (component as any).monthlyDayTotalsLoadedKey = '2026-03';
    spyOn<any>(
      component as any,
      'loadHistoricalAmountPerformance'
    ).and.resolveTo();

    await component.setPerformanceMetricMode('amount');

    expect(component.performanceMetricMode).toBe('amount');
    expect(component.amountPerformanceSummary).toEqual(
      jasmine.objectContaining({
        collectedFc: 250000,
        expectedFc: 500000,
        percent: 50,
        status: 'ready',
      })
    );
  });

  it('uses the full site expectation for the sole active agent after a manager leaves', async () => {
    const component = createComponent({
      isAdmninistrator: true,
      currentUser: {
        uid: 'owner-1',
        dailyReimbursement: { '3-27-2026': 412500 },
      },
    });
    component.employee = {
      uid: 'beverly',
      firstName: 'Beverly',
      lastName: 'Nzuzi',
      role: 'Agent Marketing',
      status: 'Travaille',
    };
    component.employees = [
      component.employee,
      {
        uid: 'former-manager',
        role: 'Manager',
        status: 'Ne travaille plus',
      },
    ];
    component.givenMonth = 3;
    component.givenYear = 2026;
    component.monthlyDayTotals = {
      '3-27-2026': {
        dayKey: '3-27-2026',
        total: 412500,
        expected: 280000,
        expectedPresent: true,
        totalPresent: true,
        employeeUid: 'beverly',
      },
    };
    (component as any).monthlyDayTotalsLoadedKey = '2026-03';
    spyOn<any>(
      component as any,
      'fetchEmployeeAmountRecordsForMonth'
    ).and.resolveTo([
      {
        dayKey: '3-27-2026',
        total: 0,
        expected: 280000,
        expectedPresent: true,
        totalPresent: true,
        employeeUid: 'former-manager',
      },
    ]);
    spyOn<any>(
      component as any,
      'loadHistoricalAmountPerformance'
    ).and.resolveTo();

    await component.setPerformanceMetricMode('amount');

    expect(component.amountPerformanceSummary).toEqual(
      jasmine.objectContaining({
        collectedFc: 412500,
        expectedFc: 560000,
        percent: 73.66071428571429,
        reconciliationDifferenceFc: 0,
        status: 'ready',
      })
    );
    expect(component.amountPerformanceScopeLabel).toBe('Total du site');
  });

  it('computes manager performance from site totals instead of averaging employees', async () => {
    const component = createComponent({
      isAdmninistrator: true,
      currentUser: {
        uid: 'owner-1',
        dailyReimbursement: { '3-27-2026': 190000 },
        weeklyPaymentTargetFc: 600000,
      },
    });
    component.employee = {
      uid: 'manager-1',
      firstName: 'Manager',
      role: 'Manager',
    };
    component.employees = [
      component.employee,
      { uid: 'employee-2', role: 'Agent Marketing' },
    ];
    component.givenMonth = 3;
    component.givenYear = 2026;
    component.monthlyDayTotals = {
      '3-27-2026': {
        dayKey: '3-27-2026',
        total: 90000,
        expected: 100000,
        expectedPresent: true,
        totalPresent: true,
        employeeUid: 'manager-1',
      },
    };
    (component as any).monthlyDayTotalsLoadedKey = '2026-03';
    spyOn<any>(
      component as any,
      'fetchEmployeeAmountRecordsForMonth'
    ).and.resolveTo([
      {
        dayKey: '3-27-2026',
        total: 100000,
        expected: 900000,
        expectedPresent: true,
        totalPresent: true,
        employeeUid: 'employee-2',
      },
    ]);
    spyOn<any>(
      component as any,
      'loadHistoricalAmountPerformance'
    ).and.resolveTo();

    await component.setPerformanceMetricMode('amount');

    expect(component.amountPerformanceSummary).toEqual(
      jasmine.objectContaining({
        collectedFc: 190000,
        expectedFc: 1000000,
        percent: 19,
        reconciliationDifferenceFc: 0,
        status: 'ready',
      })
    );
    expect(component.amountPerformanceScopeLabel).toBe('Total du site');
  });

  it('does not cache a manager percentage before the manager month records are loaded', async () => {
    const component = createComponent({
      isAdmninistrator: true,
      currentUser: {
        uid: 'owner-1',
        dailyReimbursement: { '3-27-2026': 593500 },
      },
    });
    component.employee = {
      uid: 'manager-1',
      firstName: 'Manager',
      role: 'Manager',
    };
    component.employees = [
      component.employee,
      { uid: 'employee-2', role: 'Agent Marketing' },
    ];
    component.givenMonth = 3;
    component.givenYear = 2026;
    component.performanceMetricMode = 'amount';
    const employeeFetch = spyOn<any>(
      component as any,
      'fetchEmployeeAmountRecordsForMonth'
    ).and.resolveTo([
      {
        dayKey: '3-27-2026',
        total: 403500,
        expected: 825000,
        expectedPresent: true,
        totalPresent: true,
        employeeUid: 'employee-2',
      },
    ]);

    await (component as any).loadAmountPerformancePreview();

    expect(employeeFetch).not.toHaveBeenCalled();
    expect(component.amountPerformanceSummary).toBeNull();
    expect((component as any).amountPerformanceLoadedKey).toBe('');

    component.monthlyDayTotals = {
      '3-27-2026': {
        dayKey: '3-27-2026',
        total: 40000,
        expected: 797500,
        expectedPresent: true,
        totalPresent: true,
        employeeUid: 'manager-1',
      },
    };
    (component as any).monthlyDayTotalsLoadedKey = '2026-03';

    await (component as any).loadAmountPerformancePreview();

    expect(employeeFetch).toHaveBeenCalledTimes(1);
    expect(component.amountPerformanceSummary?.expectedFc).toBe(1622500);
    expect(component.amountPerformanceSummary?.percent).toBeCloseTo(
      36.579,
      3
    );
  });

  it('uses sparse expected records because zero-expected days are not persisted', () => {
    const component = createComponent({
      isAdmninistrator: true,
      currentUser: { uid: 'owner-1', dailyReimbursement: {} },
    });
    component.employee = {
      uid: 'employee-1',
      role: 'Agent Marketing',
    };
    const sparseRecords = [
      {
        dayKey: '3-27-2026',
        total: 500,
        expected: 1000,
        expectedPresent: true,
        totalPresent: true,
        employeeUid: 'employee-1',
      },
    ];
    const oldPaymentOnlyRecords = [
      {
        dayKey: '2-27-2026',
        total: 500,
        expected: 0,
        expectedPresent: false,
        totalPresent: true,
        employeeUid: 'employee-1',
      },
    ];

    const sparse = (component as any).historicalAmountMonth(
      sparseRecords,
      3,
      2026,
      new Date(2026, 2, 28)
    );
    const unavailable = (component as any).historicalAmountMonth(
      oldPaymentOnlyRecords,
      2,
      2026,
      new Date(2026, 2, 28)
    );

    expect(sparse.eligible).toBeTrue();
    expect(sparse.summary.percent).toBe(50);
    expect(unavailable.eligible).toBeFalse();
    expect(unavailable.summary.percent).toBeNull();
  });

  it('builds a mixed histogram with amount bars and legacy fallback bars', () => {
    const component = createComponent({ isAdmninistrator: true });
    component.employee = {
      uid: 'employee-1',
      role: 'Agent Marketing',
      dailyPoints: {
        '1-10-2026': '10',
        '2-10-2026': '20',
        '3-10-2026': '30',
        '4-10-2026': '40',
      },
      totalDailyPoints: {
        '1-10-2026': '100',
        '2-10-2026': '100',
        '3-10-2026': '100',
        '4-10-2026': '100',
      },
    };
    component.performanceMetricMode = 'amount';
    (component as any).historicalAmountPerformanceByMonth = {
      '1-2026': {
        eligible: true,
        summary: {
          percent: 60,
          collectedFc: 600,
          expectedFc: 1000,
          visualPercent: 60,
        },
      },
      '2-2026': {
        eligible: false,
        summary: {
          percent: 70,
          collectedFc: 700,
          expectedFc: 1000,
          visualPercent: 70,
        },
      },
      '3-2026': {
        eligible: true,
        summary: {
          percent: 80,
          collectedFc: 800,
          expectedFc: 1000,
          visualPercent: 80,
        },
      },
      '4-2026': {
        eligible: true,
        summary: {
          percent: 90,
          collectedFc: 900,
          expectedFc: 1000,
          visualPercent: 90,
        },
      },
    };

    component.updatePerformanceGraphics(3);

    expect(component.recentPerformanceDates).toEqual([
      '2-2026',
      '3-2026',
      '4-2026',
    ]);
    const amountTrace = component.graphPerformance.data.find(
      (trace) => trace.name === 'Performance actuelle'
    );
    const fallbackTrace = component.graphPerformance.data.find(
      (trace) => trace.name === 'Performance habituelle (repli)'
    );
    expect(amountTrace?.y).toEqual([null, 80, 90]);
    expect(fallbackTrace?.y).toEqual([20, null, null]);
    expect(amountTrace?.hovertemplate).toBe(
      '<b>%{y:.1f}%</b><extra></extra>'
    );
    expect(amountTrace?.text).toBeUndefined();
    expect(component.historicalAmountMonthCount).toBe(3);
    expect(component.historicalLegacyFallbackMonthCount).toBe(1);
  });

  it('changes employee histogram values without exposing source diagnostics', () => {
    const component = createComponent({ isAdmninistrator: false });
    component.publishedEmployeePerformanceMode = 'amount';
    component.employee = {
      uid: 'employee-1',
      role: 'Agent Marketing',
      dailyPoints: {
        '1-10-2026': '20',
        '2-10-2026': '30',
      },
      totalDailyPoints: {
        '1-10-2026': '100',
        '2-10-2026': '100',
      },
    };
    (component as any).historicalAmountPerformanceByMonth = {
      '1-2026': {
        eligible: true,
        summary: {
          percent: 75,
          collectedFc: 750,
          expectedFc: 1000,
          visualPercent: 75,
        },
      },
    };

    component.updatePerformanceGraphics(0);

    expect(component.recentPerformanceNumbers).toEqual([75, 30]);
    expect(component.graphPerformance.data.length).toBe(1);
    expect(component.graphPerformance.data[0].name).toBeUndefined();
    expect(component.graphPerformance.data[0].text).toBeUndefined();
    expect(component.graphPerformance.layout.showlegend).toBeFalse();
  });

  it('uses the authoritative site total even when employee attribution needs review', () => {
    const records = completeOperatingDayRecords(3, 2026, 28);
    const siteCollected = records.reduce(
      (sum, record) => sum + record.total,
      0
    );
    const dailyReimbursement = Object.fromEntries(
      records.map((record) => [record.dayKey, record.total])
    );
    const component = createComponent({
      isAdmninistrator: true,
      currentUser: { uid: 'owner-1', dailyReimbursement },
    });
    component.employee = { uid: 'manager-1', role: 'Manager' };

    const reconciled = (component as any).historicalAmountMonth(
      records,
      3,
      2026,
      new Date(2026, 2, 28)
    );
    component.auth.currentUser.dailyReimbursement['3-28-2026'] =
      (component.auth.currentUser.dailyReimbursement['3-28-2026'] || 0) +
      100;
    const mismatched = (component as any).historicalAmountMonth(
      records,
      3,
      2026,
      new Date(2026, 2, 28)
    );

    expect(reconciled.summary.collectedFc).toBe(siteCollected);
    expect(reconciled.eligible).toBeTrue();
    expect(mismatched.summary.reconciliationDifferenceFc).toBe(100);
    expect(mismatched.summary.status).toBe('partial');
    expect(mismatched.eligible).toBeTrue();
  });

  it('uses the published metric when an admin switches to employee view', () => {
    const component = createComponent({ isAdmninistrator: true });
    component.performanceMetricMode = 'amount';
    component.publishedEmployeePerformanceMode = 'legacy';

    component.setViewAsMode('employee');

    expect(component.performanceMetricMode).toBe('amount');
    expect(component.isAmountPerformanceMode).toBeFalse();
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
      {} as any,
      { employeeMode$: of('legacy') } as any
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

  it('does not write attendance when the required photo upload fails', async () => {
    const data = {
      uploadAttendanceAttachment: jasmine
        .createSpy('uploadAttendanceAttachment')
        .and.rejectWith(new Error('offline')),
      finalizeAttendanceWithAttachment: jasmine.createSpy(
        'finalizeAttendanceWithAttachment'
      ),
      updateEmployeeAttendanceForUser: jasmine.createSpy(
        'updateEmployeeAttendanceForUser'
      ),
      setAttendanceEntry: jasmine.createSpy('setAttendanceEntry'),
    };
    const component = createComponent({ currentUser: { uid: 'site-1' } });
    (component as any).data = data;
    const employee = {
      uid: 'employee-1',
      _attachmentFile: new File(['photo'], 'presence.jpg', {
        type: 'image/jpeg',
        lastModified: 1774688400000,
      }),
    };
    component.employee = employee as any;
    spyOn(window, 'alert');
    spyOn(console, 'error');

    await component.addAttendanceForEmployee(employee, 'P');

    expect(data.uploadAttendanceAttachment).toHaveBeenCalledTimes(1);
    expect(data.finalizeAttendanceWithAttachment).not.toHaveBeenCalled();
    expect(data.updateEmployeeAttendanceForUser).not.toHaveBeenCalled();
    expect(data.setAttendanceEntry).not.toHaveBeenCalled();
    expect(employee._attachmentFile).toBeTruthy();
  });

  it('reuses a completed upload when only attendance finalization must be retried', async () => {
    const attachment = {
      url: 'https://firebase.test/presence',
      path: 'attendance_proofs/site-1/employee-1/2026-03-28/photo.jpg',
      size: 5,
      contentType: 'image/jpeg',
      uploadedAt: 1774688400000,
      uploaderId: 'site-1',
    };
    const data = {
      uploadAttendanceAttachment: jasmine
        .createSpy('uploadAttendanceAttachment')
        .and.resolveTo(attachment),
      finalizeAttendanceWithAttachment: jasmine
        .createSpy('finalizeAttendanceWithAttachment')
        .and.returnValues(
          Promise.reject(new Error('firestore unavailable')),
          Promise.resolve()
        ),
    };
    const component = createComponent({ currentUser: { uid: 'site-1' } });
    (component as any).data = data;
    const employee: any = {
      uid: 'employee-1',
      attendance: {},
      attendanceAttachments: {},
      _attachmentFile: new File(['photo'], 'presence.jpg', {
        type: 'image/jpeg',
        lastModified: 1774688400000,
      }),
    };
    component.employee = employee;
    spyOn<any>(component, 'sleep').and.resolveTo();
    spyOn<any>(component, 'invalidateAttendanceRuleCaches').and.stub();
    spyOn(component, 'generateAttendanceTable').and.stub();
    spyOn(window, 'alert');
    spyOn(console, 'error');

    await component.addAttendanceForEmployee(employee, 'P');
    await component.addAttendanceForEmployee(employee, 'P');

    expect(data.uploadAttendanceAttachment).toHaveBeenCalledTimes(1);
    expect(data.finalizeAttendanceWithAttachment).toHaveBeenCalledTimes(2);
    expect(employee.attendance['3-28-2026-9-0-0']).toBe('P');
    expect(employee._attachmentFile).toBeNull();
  });
});
