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
        .and.returnValue(2),
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

    const deductions = (component as any)
      .computePayrollWeeklyShortfallDeductions(employee);
    const week = deductions.find(
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
});
