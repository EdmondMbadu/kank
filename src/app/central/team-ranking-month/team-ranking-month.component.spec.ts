import { TeamRankingMonthComponent } from './team-ranking-month.component';

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
});
