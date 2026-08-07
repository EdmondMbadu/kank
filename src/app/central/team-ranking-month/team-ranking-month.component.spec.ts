import { TeamRankingMonthComponent } from './team-ranking-month.component';
import { EmployeePageComponent } from 'src/app/shrink/employee-page/employee-page.component';
import { of } from 'rxjs';

describe('TeamRankingMonthComponent', () => {
  function createComponent() {
    const auth = {
      currentUser: {},
      resolveWeeklyPaymentTargetForDate: jasmine
        .createSpy('resolveWeeklyPaymentTargetForDate')
        .and.returnValue(1200000),
      resolveWeeklyDeductionTargetForDate: jasmine
        .createSpy('resolveWeeklyDeductionTargetForDate')
        .and.returnValue(900000),
    } as any;
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
      todaysDateKinshasFormat: () => '23 Juillet 2026',
      todaysDateMonthDayYear: () => '7-23-2026',
      convertDateToDayMonthYear: () => '23 Juillet 2026',
      getTodaysDateYearMonthDay: () => '2026-07-23',
      toDate: (dateKey: string) => {
        const [month, day, year] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day);
      },
    } as any;
    const compute = {
      getMonthNameFrench: () => 'Juillet',
      computeWeeklyObjectiveDeductionUsd: jasmine
        .createSpy('computeWeeklyObjectiveDeductionUsd')
        .and.callFake((totalFc: number, targetFc: number) =>
          totalFc < targetFc
            ? Math.ceil((targetFc - totalFc) / 100000)
            : 0
        ),
      computeWeeklyObjectiveBonusUsd: jasmine
        .createSpy('computeWeeklyObjectiveBonusUsd')
        .and.callFake((totalFc: number, visibleTargetFc: number) =>
          totalFc >= visibleTargetFc
            ? Math.floor((totalFc - visibleTargetFc) / 100000) + 1
            : 0
        ),
      computeWeeklyObjectiveAdjustmentUsd: jasmine
        .createSpy('computeWeeklyObjectiveAdjustmentUsd')
        .and.returnValue({
          kind: 'deduction',
          amountUsd: 2,
          signedAmountUsd: -2,
          bandCount: 2,
        }),
    } as any;
    const performanceMetricSettings = {
      employeeMode$: of('legacy'),
      updateEmployeeMode: jasmine
        .createSpy('updateEmployeeMode')
        .and.resolveTo(),
    } as any;

    const component = new TeamRankingMonthComponent(
      {} as any,
      auth,
      time,
      {} as any,
      compute,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      performanceMetricSettings
    );
    return { component, auth, compute, performanceMetricSettings };
  }

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 6, 23));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('should create', () => {
    expect(createComponent().component).toBeTruthy();
  });

  it('does not load the amount performance metric for non-admin users', async () => {
    const { component, auth } = createComponent();
    auth.isAdmin = false;
    const loadSpy = spyOn<any>(
      component as any,
      'loadAmountPerformancePreview'
    );

    await component.setPerformanceMetricMode('amount');

    expect(component.performanceMetricMode).toBe('legacy');
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('uses the published amount metric for employees without exposing diagnostics', () => {
    const { component, auth } = createComponent();
    auth.isAdmin = false;
    component.publishedEmployeePerformanceMode = 'amount';
    component.averagePerformancePercentage = '41';
    component.amountPerformanceSummary = {
      percent: 62.5,
      visualPercent: 62.5,
    } as any;
    const employee = {
      uid: 'employee-1',
      role: 'Agent Marketing',
      performancePercentageMonth: '35',
    } as any;
    (component as any).amountPerformanceByEmployee = {
      '|employee-1': { percent: 70, visualPercent: 70 },
    };

    expect(component.isAmountPerformanceMode).toBeTrue();
    expect(component.showAmountPerformanceDiagnostics).toBeFalse();
    expect(component.currentPerformancePercent).toBe(62.5);
    expect(component.employeePerformancePercent(employee)).toBe(70);
  });

  it('initializes the admin ranking preview from the published amount mode', () => {
    const { component, auth } = createComponent();
    auth.isAdmin = true;
    component.performanceMetricMode = 'legacy';
    component.allEmployeesAll = [{ uid: 'employee-1' } as any];
    const loadSpy = spyOn<any>(
      component as any,
      'loadAmountPerformancePreview'
    ).and.resolveTo();

    (component as any).applyPublishedEmployeePerformanceMode('amount');

    expect(component.publishedEmployeePerformanceMode).toBe('amount');
    expect(component.performanceMetricMode).toBe('amount');
    expect(component.isAmountPerformanceMode).toBeTrue();
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not launch amount queries when the published mode is habitual', () => {
    const { component, auth } = createComponent();
    auth.isAdmin = true;
    component.performanceMetricMode = 'amount';
    component.allEmployeesAll = [{ uid: 'employee-1' } as any];
    const loadSpy = spyOn<any>(
      component as any,
      'loadAmountPerformancePreview'
    );
    spyOn(component, 'setGraphics');

    (component as any).applyPublishedEmployeePerformanceMode('legacy');

    expect(component.performanceMetricMode).toBe('legacy');
    expect(component.isAmountPerformanceMode).toBeFalse();
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('falls back to habitual employee percentages when amount data is unavailable', () => {
    const { component, auth } = createComponent();
    auth.isAdmin = false;
    component.publishedEmployeePerformanceMode = 'amount';
    component.averagePerformancePercentage = '41';
    const employee = { uid: 'employee-1', performancePercentageMonth: '35' } as any;

    expect(component.currentPerformancePercent).toBe(41);
    expect(component.employeePerformancePercent(employee)).toBe(35);
    expect(component.employeePerformanceVisualPercent(employee)).toBe(35);
  });

  it('keeps verifier rows on habitual performance in amount mode', () => {
    const { component, auth } = createComponent();
    auth.isAdmin = true;
    component.performanceMetricMode = 'amount';
    const verifier = {
      uid: 'verifier-1',
      role: 'Vérificateur',
      performancePercentageMonth: '46',
    } as any;
    (component as any).amountPerformanceByEmployee = {
      '|verifier-1': {
        percent: 91,
        visualPercent: 91,
      },
    };

    expect(component.employeeUsesAmountPerformance(verifier)).toBeFalse();
    expect(component.employeePerformancePercent(verifier)).toBe(46);
    expect(component.employeePerformanceVisualPercent(verifier)).toBe(46);
  });

  it('publishes the global employee mode and mirrors it in the admin preview', async () => {
    const { component, auth, performanceMetricSettings } = createComponent();
    auth.isAdmin = true;
    auth.currentUser = { uid: 'admin-1' };
    spyOn<any>(component as any, 'loadAmountPerformancePreview').and.resolveTo();

    await component.publishEmployeePerformanceMode('amount');

    expect(performanceMetricSettings.updateEmployeeMode).toHaveBeenCalledWith(
      'amount',
      'admin-1'
    );
    expect(component.publishedEmployeePerformanceMode).toBe('amount');
    expect(component.performanceMetricMode).toBe('amount');
    expect(component.performanceMetricSettingMessage).toContain('publiée');
  });

  it('keeps the previous published mode when saving fails', async () => {
    spyOn(console, 'error');
    const { component, auth, performanceMetricSettings } = createComponent();
    auth.isAdmin = true;
    component.publishedEmployeePerformanceMode = 'legacy';
    performanceMetricSettings.updateEmployeeMode.and.rejectWith(
      new Error('permission denied')
    );

    await component.publishEmployeePerformanceMode('amount');

    expect(component.publishedEmployeePerformanceMode).toBe('legacy');
    expect(component.performanceMetricMode).toBe('legacy');
    expect(component.performanceMetricSettingMessage).toContain('Impossible');
  });

  it('computes and caches the global amount performance from all sites', async () => {
    const { component, auth } = createComponent();
    auth.isAdmin = true;
    component.givenMonth = 7;
    component.givenYear = 2026;

    const siteA = {
      uid: 'site-a',
      dailyReimbursement: {
        '7-1-2026': '300',
        '7-2-2026': '200',
      },
    } as any;
    const siteB = {
      uid: 'site-b',
      dailyReimbursement: { '7-1-2026': '100' },
    } as any;
    component.allUsers = [siteA, siteB];
    component.allEmployeesAll = [
      { uid: 'employee-a', tempUser: siteA },
      { uid: 'employee-b', tempUser: siteB },
    ] as any;

    const fetchSpy = spyOn<any>(
      component as any,
      'fetchEmployeeAmountRecordsForMonth'
    ).and.callFake((_ownerUid: string, employeeUid: string) =>
      Promise.resolve(
        employeeUid === 'employee-a'
          ? [
              {
                dayKey: '7-1-2026',
                expected: 400,
                total: 300,
                expectedPresent: true,
                totalPresent: true,
                employeeUid,
              },
              {
                dayKey: '7-2-2026',
                expected: 300,
                total: 200,
                expectedPresent: true,
                totalPresent: true,
                employeeUid,
              },
            ]
          : [
              {
                dayKey: '7-1-2026',
                expected: 200,
                total: 100,
                expectedPresent: true,
                totalPresent: true,
                employeeUid,
              },
            ]
      )
    );

    await component.setPerformanceMetricMode('amount');
    await component.setPerformanceMetricMode('amount');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(component.amountPerformanceSummary).toEqual(
      jasmine.objectContaining({
        collectedFc: 600,
        expectedFc: 900,
        percent: 66.66666666666666,
        reconciliationDifferenceFc: 0,
        status: 'ready',
      })
    );
    expect(component.currentPerformancePercent).toBeCloseTo(66.67, 2);
  });

  it('uses site totals as the global numerator and exposes reconciliation gaps', async () => {
    const { component, auth } = createComponent();
    auth.isAdmin = true;
    component.givenMonth = 7;
    component.givenYear = 2026;
    const site = {
      uid: 'site-a',
      dailyReimbursement: { '7-1-2026': '600' },
    } as any;
    component.allUsers = [site];
    component.allEmployeesAll = [
      { uid: 'employee-a', tempUser: site },
    ] as any;
    spyOn<any>(
      component as any,
      'fetchEmployeeAmountRecordsForMonth'
    ).and.resolveTo([
      {
        dayKey: '7-1-2026',
        expected: 900,
        total: 550,
        expectedPresent: true,
        totalPresent: true,
        employeeUid: 'employee-a',
      },
    ]);

    await component.setPerformanceMetricMode('amount');

    expect(component.amountPerformanceSummary).toEqual(
      jasmine.objectContaining({
        collectedFc: 600,
        expectedFc: 900,
        reconciliationDifferenceFc: 50,
        status: 'partial',
      })
    );
  });

  it('switches every employee row to amount performance and keeps managers site-scoped', async () => {
    const { component, auth } = createComponent();
    auth.isAdmin = true;
    component.givenMonth = 7;
    component.givenYear = 2026;
    const site = {
      uid: 'site-a',
      dailyReimbursement: { '7-1-2026': '400' },
    } as any;
    const manager = {
      uid: 'manager-a',
      role: 'Manager',
      performancePercentageMonth: '90',
      tempUser: site,
    } as any;
    const employee = {
      uid: 'employee-a',
      role: 'Agent Marketing',
      performancePercentageMonth: '20',
      tempUser: site,
    } as any;
    component.allUsers = [site];
    component.allEmployees = [manager, employee];
    component.allEmployeesAll = [manager, employee];
    spyOn<any>(
      component as any,
      'fetchEmployeeAmountRecordsForMonth'
    ).and.callFake((_ownerUid: string, employeeUid: string) =>
      Promise.resolve([
        employeeUid === 'manager-a'
          ? {
              dayKey: '7-1-2026',
              expected: 200,
              total: 100,
              expectedPresent: true,
              totalPresent: true,
              employeeUid,
            }
          : {
              dayKey: '7-1-2026',
              expected: 400,
              total: 300,
              expectedPresent: true,
              totalPresent: true,
              employeeUid,
            },
      ])
    );

    await component.setPerformanceMetricMode('amount');

    expect(component.employeePerformancePercent(employee)).toBe(75);
    expect(component.employeePerformancePercent(manager)).toBeCloseTo(
      66.67,
      2
    );
    expect(component.employeeAmountPerformanceScopeLabel(employee)).toBe(
      'Individuel'
    );
    expect(component.employeeAmountPerformanceScopeLabel(manager)).toBe(
      'Total du site'
    );
    expect(component.performanceEmployees.map((item) => item.uid)).toEqual([
      'employee-a',
      'manager-a',
    ]);
  });

  it('uses site totals for the sole active agent when their manager has left', async () => {
    const { component, auth } = createComponent();
    auth.isAdmin = true;
    component.givenMonth = 7;
    component.givenYear = 2026;
    const site = {
      uid: 'site-beverly',
      dailyReimbursement: { '7-1-2026': 412500 },
    } as any;
    const beverly = {
      uid: 'beverly',
      firstName: 'Beverly',
      lastName: 'Nzuzi',
      role: 'Agent Marketing',
      status: 'Travaille',
      tempUser: site,
    } as any;
    const formerManager = {
      uid: 'former-manager',
      role: 'Manager',
      status: 'Ne travaille plus',
      tempUser: site,
    } as any;
    component.allUsers = [site];
    component.allEmployees = [beverly];
    component.allEmployeesAll = [beverly, formerManager];
    spyOn<any>(
      component as any,
      'fetchEmployeeAmountRecordsForMonth'
    ).and.callFake((_ownerUid: string, employeeUid: string) =>
      Promise.resolve([
        {
          dayKey: '7-1-2026',
          expected: 280000,
          total: employeeUid === 'beverly' ? 412500 : 0,
          expectedPresent: true,
          totalPresent: true,
          employeeUid,
        },
      ])
    );

    await component.setPerformanceMetricMode('amount');

    expect(component.employeeAmountPerformanceSummary(beverly)).toEqual(
      jasmine.objectContaining({
        collectedFc: 412500,
        expectedFc: 560000,
        percent: 73.66071428571429,
      })
    );
    expect(component.employeeAmountPerformanceScopeLabel(beverly)).toBe(
      'Total du site'
    );
  });

  it('invalidates amount performance when active site membership changes', () => {
    const { component } = createComponent();
    const site = { uid: 'site-a' } as any;
    const employee = {
      uid: 'employee-a',
      role: 'Agent Marketing',
      tempUser: site,
    } as any;
    const manager = {
      uid: 'manager-a',
      role: 'Manager',
      tempUser: site,
    } as any;
    component.allUsers = [site];
    component.allEmployeesAll = [employee, manager];
    component.allEmployees = [employee, manager];
    const teamCacheKey = (component as any).amountPerformanceCacheKey();

    component.allEmployees = [employee];
    const soleEmployeeCacheKey = (component as any)
      .amountPerformanceCacheKey();

    expect(soleEmployeeCacheKey).not.toBe(teamCacheKey);
  });

  it('includes former and vacationing employees only in the trophy history map', () => {
    const { component } = createComponent();
    const activeEmployee = {
      uid: 'active',
      firstName: 'Active',
      lastName: 'Employee',
      status: 'Travaille',
      bestEmployeeTrophies: [{ month: '1', year: '2026' }],
    } as any;
    const formerEmployee = {
      uid: 'former',
      firstName: 'Former',
      lastName: 'Employee',
      status: 'Ne travaille plus',
      bestTeamTrophies: [{ month: '2', year: '2025' }],
    } as any;
    const vacationingEmployee = {
      uid: 'vacation',
      firstName: 'Vacation',
      lastName: 'Employee',
      status: 'Vacances',
      bestEmployeeTrophies: [{ month: '3', year: '2024' }],
    } as any;
    const formerDuplicateOfActive = {
      uid: 'active-old-record',
      firstName: 'Active',
      lastName: 'Employee',
      status: 'Ne travaille plus',
      bestEmployeeTrophies: [{ month: '1', year: '2026' }],
      bestTeamTrophies: [{ month: '4', year: '2025' }],
    } as any;

    component.allEmployees = [activeEmployee];
    component.allEmployeesAll = [
      formerDuplicateOfActive,
      activeEmployee,
      formerEmployee,
      vacationingEmployee,
    ];

    expect(
      component.trophyHeatmapTiles.map((tile) => tile.employee.uid)
    ).toEqual(jasmine.arrayWithExactContents(['active', 'former', 'vacation']));
    expect(component.trophyHeatmapStats.employeesWithTrophies).toBe(3);
    expect(component.allEmployees).toEqual([activeEmployee]);
    const activeTile = component.trophyHeatmapTiles.find(
      (tile) => tile.employee.uid === 'active'
    );
    expect(activeTile?.total).toBe(2);
  });

  it('keeps the visible objective but calculates payroll from the internal threshold', () => {
    const { component, compute } = createComponent();
    component.givenMonth = 6;
    component.givenYear = 2026;
    const owner = {
      dailyReimbursement: {
        '6-1-2026': 700000,
      },
    };
    const employee = { tempUser: owner } as any;

    const adjustments = (component as any)
      .computePayrollWeeklyObjectiveAdjustments(employee);
    const week = adjustments.deductions.find(
      (item: any) => item.end === '2026-06-07'
    );

    expect(week).toEqual(
      jasmine.objectContaining({
        weeklyTotalFc: 700000,
        weeklyTargetFc: 1200000,
        weeklyDeductionTargetFc: 900000,
        amount: 2,
      })
    );
    expect(compute.computeWeeklyObjectiveDeductionUsd).toHaveBeenCalledWith(
      700000,
      900000
    );
  });

  it('does not add a bonus at 901K when the global visible minimum is 1.2M', () => {
    const { component, auth, compute } = createComponent();
    component.givenMonth = 7;
    component.givenYear = 2026;
    const owner = {
      weeklyPaymentTargetFc: 900000,
      dailyReimbursement: {
        '7-13-2026': 901000,
      },
    };
    const employee = { tempUser: owner } as any;

    const adjustments = (component as any)
      .computePayrollWeeklyObjectiveAdjustments(employee);

    expect(
      adjustments.bonuses.some(
        (item: any) => item.end === '2026-07-19'
      )
    ).toBeFalse();
    expect(compute.computeWeeklyObjectiveBonusUsd).toHaveBeenCalledWith(
      901000,
      1200000
    );
    expect(auth.resolveWeeklyPaymentTargetForDate).toHaveBeenCalledWith(
      '7-13-2026'
    );
  });

  it('matches the employee page salary and bonus totals for the same saved draft', () => {
    const { component, auth, compute } = createComponent();
    component.givenMonth = 7;
    component.givenYear = 2026;
    const employee: any = {
      uid: 'employee-1',
      firstName: 'Test',
      lastName: 'Employé',
      role: 'Agent Marketing',
      paymentConfiguredMonthKey: '2026-07',
      paymentAmount: '100',
      paymentBankFee: '5',
      paymentIncreaseYears: '10',
      paymentManualAddition: '3',
      paymentManualWithdrawal: '4',
      paymentAbsent: '3',
      paymentNothing: '0',
      paymentLate: '1',
      paymentObjectiveWeekDeductionTotal: '99',
      paymentObjectiveWeekDeductions: [
        { start: '2026-07-06', end: '2026-07-12', amount: 2 },
      ],
      paymentObjectiveWeekBonusTotal: '99',
      paymentObjectiveWeekBonuses: [
        {
          start: '2026-07-13',
          end: '2026-07-19',
          amount: 2,
          weeklyTotalFc: 1300000,
          weeklyTargetFc: 1200000,
        },
      ],
      paymentObjectiveWeekBonusesManuallyAdjusted: true,
      bonusAmount: '7',
      bestTeamBonusAmount: '2',
      bestEmployeeBonusAmount: '1',
      bestManagerBonusAmount: '0',
      totalBonusThisMonth: '999',
      tempUser: { dailyReimbursement: {} },
    };

    const employeePage = new EmployeePageComponent(
      {} as any,
      {} as any,
      auth,
      {
        yearsList: [2026],
        todaysDateMonthDayYear: () => '7-23-2026',
        convertDateToDayMonthYear: () => '23 Juillet 2026',
        getTodaysDateYearMonthDay: () => '2026-07-23',
        toDate: (dateKey: string) => {
          const [month, day, year] = dateKey.split('-').map(Number);
          return new Date(year, month - 1, day);
        },
      } as any,
      compute,
      {} as any,
      { snapshot: { paramMap: { get: () => 'employee-1' } } } as any,
      {} as any,
      {} as any,
      {} as any,
      { employeeMode$: of('legacy') } as any
    );
    employeePage.employee = employee;
    employeePage.paymentAmount = 100;
    employeePage.paymentBankFee = 5;
    employeePage.paymentIncreaseYears = 10;
    employeePage.paymentManualAddition = 3;
    employeePage.paymentManualWithdrawal = 4;
    employeePage.paymentAbsent = 3;
    employeePage.paymentNothing = 0;
    employeePage.paymentLate = 1;
    employeePage.paymentObjectiveWeekDeductions = [
      { start: '2026-07-06', end: '2026-07-12', amount: 2 },
    ];
    employeePage.paymentObjectiveWeekDeductionTotal = 99;
    employeePage.paymentObjectiveWeekBonuses = [
      {
        start: '2026-07-13',
        end: '2026-07-19',
        amount: 2,
        weeklyTotalFc: 1300000,
        weeklyTargetFc: 1200000,
      },
    ];
    employeePage.paymentObjectiveWeekBonusTotal = 99;
    employeePage.paymentObjectiveWeekBonusesManuallyAdjusted = true;
    employeePage.bonusAmount = 7;
    employeePage.bestTeamBonusAmount = 2;
    employeePage.bestEmployeeBonusAmount = 1;
    employeePage.bestManagerBonusAmount = 0;

    (employeePage as any).ensurePaymentDraftForCurrentMonth();
    employeePage.computeTotalBonusAmount();
    const row = (component as any).buildPayrollBreakdownRow(employee);

    expect(row.net).toBe(employeePage.totalPayments);
    expect(row.bonusTotal).toBe(employeePage.totalBonusAmount);
    expect(row.totalDue).toBe(
      employeePage.totalPayments + employeePage.totalBonusAmount
    );
    expect(row.objective).toBe(2);
    expect(row.objectiveBonus).toBe(2);
  });
});
