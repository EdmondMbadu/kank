import { TeamRankingMonthComponent } from './team-ranking-month.component';
import { EmployeePageComponent } from 'src/app/shrink/employee-page/employee-page.component';

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
      {} as any
    );
    return { component, auth, compute };
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
      {} as any
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
