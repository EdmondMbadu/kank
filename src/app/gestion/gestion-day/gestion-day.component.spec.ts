import { GestionDayComponent } from './gestion-day.component';

describe('GestionDayComponent confirmed planned-expense saves', () => {
  let component: GestionDayComponent;
  let data: jasmine.SpyObj<any>;

  beforeEach(() => {
    spyOn(window, 'alert');
    spyOn(console, 'error');

    data = jasmine.createSpyObj('DataService', [
      'addBudgetPlannedExpense',
    ]);
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const auth = {
      isAdmin: true,
      currentUser: { firstName: 'Audit' },
      managementInfo: { id: 'management-1' },
    };
    const time = {
      getTodaysDateYearMonthDay: () => '2026-07-25',
      todaysDateMonthDayYear: () => '7-25-2026',
      yesterdaysDateMonthDayYear: () => '7-24-2026',
      getTomorrowsDateMonthDayYear: () => '7-26-2026',
      convertDateToDayMonthYear: (date: string) => date,
    };
    const compute = {
      convertUsDollarsToCongoleseFranc: (amount: string) =>
        (Number(amount) * 2800).toString(),
    };

    component = new GestionDayComponent(
      router,
      auth as any,
      time as any,
      compute as any,
      data,
      {} as any
    );
    component.showBudgetModal = true;
    component.budgetInput = 50;
    component.budgetReason = 'Transport';
  });

  it('blocks duplicate planned-expense writes until confirmation', async () => {
    let confirmWrite!: () => void;
    data.addBudgetPlannedExpense.and.returnValue(
      new Promise<void>((resolve) => {
        confirmWrite = resolve;
      })
    );
    spyOn(component, 'initalizeInputs');

    const firstSave = component.saveBudgetedExpense();
    await component.saveBudgetedExpense();

    expect(component.isSavingBudgetedExpense).toBeTrue();
    expect(data.addBudgetPlannedExpense).toHaveBeenCalledTimes(1);
    expect(component.showBudgetModal).toBeTrue();

    confirmWrite();
    await firstSave;

    expect(component.showBudgetModal).toBeFalse();
    expect(component.initalizeInputs).toHaveBeenCalled();
    expect(component.isSavingBudgetedExpense).toBeFalse();
  });

  it('keeps the modal and values open after rejection', async () => {
    data.addBudgetPlannedExpense.and.returnValue(
      Promise.reject(new Error('offline'))
    );

    await component.saveBudgetedExpense();

    expect(component.showBudgetModal).toBeTrue();
    expect(component.budgetInput).toBe(50);
    expect(component.budgetReason).toBe('Transport');
    expect(component.isSavingBudgetedExpense).toBeFalse();
    expect(window.alert).toHaveBeenCalledWith(
      "Impossible d'enregistrer cette dépense planifiée."
    );
  });
});

describe('GestionDayComponent weekly payment history', () => {
  function createComponent(isAdmin = true): GestionDayComponent {
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const auth = {
      isAdmin,
      currentUser: { firstName: 'Admin' },
      managementInfo: { id: 'management-1' },
      resolveWeeklyPaymentTargetForDate: () => 1200000,
    };
    const time = {
      getTodaysDateYearMonthDay: () => '2026-07-26',
      todaysDateMonthDayYear: () => '7-26-2026',
      yesterdaysDateMonthDayYear: () => '7-25-2026',
      getTomorrowsDateMonthDayYear: () => '7-27-2026',
      convertDateToDayMonthYear: (date: string) => date,
      convertDateToMonthDayYear: (date: string) => {
        const [year, month, day] = date.split('-');
        return `${Number(month)}-${Number(day)}-${year}`;
      },
      toDate: (date: string) => {
        const [month, day, year] = date.split('-').map(Number);
        return new Date(year, month - 1, day);
      },
    };
    const compute = {
      convertCongoleseFrancToUsDollars: (amount: string) =>
        (Number(amount) / 3000).toString(),
    };

    return new GestionDayComponent(
      router,
      auth as any,
      time as any,
      compute as any,
      {} as any,
      {} as any
    );
  }

  it('aggregates every team by Monday-to-Sunday week and preserves zero weeks', () => {
    const component = createComponent();
    component.weeklyPaymentDateCorrectFormat = '7-26-2026';
    component.allUsers = [
      {
        firstName: 'Pumbu',
        dailyReimbursement: {
          '7-6-2026': '100000',
          '7-7-2026': '50000',
          '7-20-2026': '200000',
        },
      },
      {
        firstName: 'Matadikibala',
        dailyReimbursement: {
          '7-8-2026': '25000',
          '7-26-2026': '300000',
          '7-40-2026': '999999',
          '8-3-2026': '999999',
        },
      },
    ];

    component.updateWeeklyPaymentHistory('1M');
    const start = new Date(2026, 5, 22);
    const end = new Date(2026, 6, 26);
    const points = (component as any).buildWeeklyPaymentHistory(start, end);

    expect(points.map((point: any) => point.totalFc)).toEqual([
      0,
      0,
      175000,
      0,
      500000,
    ]);
    expect(
      points.map((point: any) => component['formatIsoDate'](point.weekStart))
    ).toEqual([
      '2026-06-22',
      '2026-06-29',
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
    ]);
  });

  it('does no history computation or chart mutation for non-admin viewers', () => {
    const component = createComponent(false);
    const initialGraph = component.graphWeeklyPayments;
    component.allUsers = [
      {
        firstName: 'Audit',
        dailyReimbursement: { '7-20-2026': '500000' },
      },
    ];

    component.updateWeeklyPaymentHistory('1A');

    expect(component.weeklyPaymentHistoryRange).toBe('1M');
    expect(component.graphWeeklyPayments).toBe(initialGraph);
    expect(
      (component as any).buildWeeklyPaymentHistory(
        new Date(2026, 6, 20),
        new Date(2026, 6, 26)
      )
    ).toEqual([]);
  });

  it('builds a dual-currency weekly graph and marks the current week partial', () => {
    const component = createComponent();
    component.weeklyPaymentDateCorrectFormat = '7-26-2026';
    component.allUsers = [
      {
        firstName: 'Pumbu',
        dailyReimbursement: {
          '7-13-2026': '300000',
          '7-20-2026': '600000',
        },
      },
    ];

    component.updateWeeklyPaymentHistory('1M');

    expect(component.weeklyPaymentHistoryIncludesCurrentWeek).toBeTrue();
    expect(component.graphWeeklyPayments.data).toHaveSize(1);
    expect(component.graphWeeklyPayments.data[0].y.slice(-2)).toEqual([
      100,
      200,
    ]);
    expect(
      component.graphWeeklyPayments.data[0].customdata.slice(-1)[0]
    ).toEqual([
      600000,
      'Semaine du 20/07/2026 au 26/07/2026',
      '<br><i>Semaine en cours (partielle)</i>',
    ]);
  });

  it('defaults to payment and toggles between combined and reserve-only history', () => {
    const component = createComponent();
    component.weeklyPaymentDateCorrectFormat = '7-26-2026';
    component.allUsers = [
      {
        firstName: 'Pumbu',
        dailyReimbursement: {
          '7-20-2026': '600000',
        },
        reserve: {
          '7-20-2026-9-15-0': '300000',
        },
      } as any,
    ];

    component.updateWeeklyPaymentHistory('1M');

    expect(component.weeklyPaymentHistoryMode).toBe('payment');
    expect(component.graphWeeklyPayments.data).toHaveSize(1);
    expect(component.graphWeeklyPayments.data[0].name).toBe('Paiements');

    component.setWeeklyPaymentHistoryMode('combined');

    expect(component.weeklyPaymentHistoryHeading).toContain(
      'Paiements et de la Réserve'
    );
    expect(component.graphWeeklyPayments.data).toHaveSize(2);
    expect(
      component.graphWeeklyPayments.data.map((trace: any) => trace.name)
    ).toEqual(['Paiements', 'Réserve']);
    expect(component.graphWeeklyPayments.data[0].y.slice(-1)).toEqual([200]);
    expect(component.graphWeeklyPayments.data[1].y.slice(-1)).toEqual([100]);
    expect(component.graphWeeklyPayments.layout.showlegend).toBeTrue();

    component.setWeeklyPaymentHistoryMode('reserve');

    expect(component.weeklyPaymentHistoryHeading).toBe(
      'Évolution de la Réserve de la Semaine'
    );
    expect(component.graphWeeklyPayments.data).toHaveSize(1);
    expect(component.graphWeeklyPayments.data[0].name).toBe('Réserve');
    expect(component.graphWeeklyPayments.data[0].y.slice(-1)).toEqual([100]);
  });

  it('focuses the y-axis on positive weekly values without forcing a zero baseline', () => {
    const component = createComponent();
    component.allUsers = [
      {
        firstName: 'Pumbu',
        dailyReimbursement: {
          '7-6-2026': '3600000',
          '7-13-2026': '5100000',
        },
      },
    ];
    component.weeklyPaymentHistoryStartDate = '2026-07-06';
    component.weeklyPaymentHistoryEndDate = '2026-07-19';

    component.applyWeeklyPaymentHistoryDateRange();

    const graph = component.graphWeeklyPayments;
    expect(graph.data[0].y).toEqual([1200, 1700]);
    expect(graph.data[0].fill).toBeUndefined();
    expect(graph.layout.yaxis.autorange).toBeFalse();
    expect(graph.layout.yaxis.range[0]).toBeGreaterThan(0);
    expect(graph.layout.yaxis.range[0]).toBeLessThan(1200);
    expect(graph.layout.yaxis.range[1]).toBeGreaterThan(1700);
  });

  it('applies an exact inclusive custom interval and labels partial boundary weeks', () => {
    const component = createComponent();
    component.allUsers = [
      {
        firstName: 'Pumbu',
        dailyReimbursement: {
          '1-12-2026': '900000',
          '1-15-2026': '300000',
          '1-19-2026': '600000',
          '7-26-2026': '1200000',
        },
      },
    ];
    component.weeklyPaymentHistoryStartDate = '2026-01-15';
    component.weeklyPaymentHistoryEndDate = '2026-07-26';

    component.applyWeeklyPaymentHistoryDateRange();

    const trace = component.graphWeeklyPayments.data[0];
    expect(component.weeklyPaymentHistoryRange).toBe('CUSTOM');
    expect(component.weeklyPaymentHistoryDateRangeLabel).toBe(
      '15/01/2026 – 26/07/2026'
    );
    expect(trace.customdata[0]).toEqual([
      300000,
      'Semaine du 12/01/2026 au 18/01/2026',
      '<br><i>Début de période (semaine partielle)</i>',
    ]);
    expect(trace.customdata[trace.customdata.length - 1]).toEqual([
      1200000,
      'Semaine du 20/07/2026 au 26/07/2026',
      '<br><i>Semaine en cours (partielle)</i>',
    ]);
  });

  it('rejects a reversed custom interval without replacing the graph', () => {
    const component = createComponent();
    const initialGraph = component.graphWeeklyPayments;
    component.weeklyPaymentHistoryStartDate = '2026-07-26';
    component.weeklyPaymentHistoryEndDate = '2026-01-15';

    component.applyWeeklyPaymentHistoryDateRange();

    expect(component.weeklyPaymentHistoryRange).toBe('1M');
    expect(component.graphWeeklyPayments).toBe(initialGraph);
    expect(component.weeklyPaymentHistoryDateError).toBe(
      'La date de début doit précéder ou être égale à la date de fin.'
    );
  });

  it('adds Monday-to-Sunday reserve totals and progress without another data request', () => {
    const component = createComponent();
    component.weeklyPaymentDateCorrectFormat = '8-7-2026';
    component.allUsers = [
      {
        uid: 'pumbu',
        firstName: 'Pumbu',
        dailyReimbursement: {
          '8-3-2026': '300000',
          '8-7-2026': '300000',
          '8-10-2026': '999999',
        },
        reserve: {
          '8-3-2026-9-0-0': '100000',
          '8-7-2026-10-0-0': '200000',
          '8-9-2026-11-0-0': '300000',
          '8-10-2026-9-0-0': '999999',
        },
      } as any,
    ];
    (component as any).weeklyClientsByUser.set('pumbu', []);
    spyOn<any>(component, 'computeWeeklyExpectedTotalForUser').and.returnValue(
      1200000
    );

    (component as any).computeWeeklyPaymentTotals();

    expect(component.weeklyPaymentTotals).toHaveSize(1);
    expect(component.weeklyPaymentTotals[0]).toEqual(
      jasmine.objectContaining({
        weeklyReserveFc: 600000,
        weeklyReserveDollar: 200,
        weeklyReserveProgressPercent: 50,
        weeklyReserveProgressTone: 'yellow',
        weeklyReserveProgressStatusLabel: '50%+',
      })
    );
    expect(component.overallWeeklyReserveTotal).toBe(600000);
    expect(component.overallWeeklyReserveTotalDollar).toBe(200);
    expect(component.overallWeeklyReserveProgressPercent).toBe(50);
    expect(component.overallWeeklyReserveProgressTone).toBe('yellow');
  });
});

describe('GestionDayComponent upcoming request summary', () => {
  function createComponent(isAdmin = true): {
    component: GestionDayComponent;
    compute: jasmine.SpyObj<any>;
  } {
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const auth = { isAdmin };
    const time = {
      getTodaysDateYearMonthDay: () => '2026-08-13',
      todaysDateMonthDayYear: () => '8-13-2026',
      yesterdaysDateMonthDayYear: () => '8-12-2026',
      getTomorrowsDateMonthDayYear: () => '8-14-2026',
      convertDateToDayMonthYear: (date: string) => date,
    };
    const compute = jasmine.createSpyObj('ComputationService', [
      'convertCongoleseFrancToUsDollars',
    ]);
    compute.convertCongoleseFrancToUsDollars.and.callFake(
      (amount: string) => (Number(amount) / 2900).toString()
    );

    return {
      component: new GestionDayComponent(
        router,
        auth as any,
        time as any,
        compute,
        {} as any,
        {} as any
      ),
      compute,
    };
  }

  it('groups valid future request amounts by date and sorts them', () => {
    const { component } = createComponent();

    (component as any).resetUpcomingRequestSummary();
    (component as any).addUpcomingRequest('8-15-2026', '300000');
    (component as any).addUpcomingRequest('8-14-2026', '75000');
    (component as any).addUpcomingRequest('08-15-2026', '125000');
    (component as any).addUpcomingRequest('8-13-2026', '999999');
    (component as any).addUpcomingRequest('8-12-2026', '999999');
    (component as any).addUpcomingRequest('invalid', '999999');
    (component as any).addUpcomingRequest('8-16-2026', '0');
    (component as any).finalizeUpcomingRequestSummary();

    expect(component.upcomingRequestTotals).toEqual([
      jasmine.objectContaining({
        dateKey: '8-14-2026',
        displayDate: 'Vendredi 14 Août 2026',
        totalFc: 75000,
      }),
      jasmine.objectContaining({
        dateKey: '8-15-2026',
        displayDate: 'Samedi 15 Août 2026',
        totalFc: 425000,
      }),
    ]);
    expect(component.overallUpcomingRequestTotal).toBe(500000);
    expect(component.overallUpcomingRequestTotalInDollars).toBe(
      500000 / 2900
    );
    expect(component.upcomingRequestsReady).toBeTrue();

    component.toggleUpcomingRequests();
    expect(component.isUpcomingRequestsExpanded).toBeTrue();
    component.toggleUpcomingRequests();
    expect(component.isUpcomingRequestsExpanded).toBeFalse();
  });

  it('does not aggregate or convert anything for a non-admin viewer', () => {
    const { component, compute } = createComponent(false);

    (component as any).resetUpcomingRequestSummary();
    (component as any).addUpcomingRequest('8-14-2026', '300000');
    (component as any).finalizeUpcomingRequestSummary();

    expect(component.upcomingRequestTotals).toEqual([]);
    expect(component.overallUpcomingRequestTotal).toBe(0);
    expect(component.upcomingRequestsReady).toBeFalse();
    expect(compute.convertCongoleseFrancToUsDollars).not.toHaveBeenCalled();

    component.upcomingRequestTotals = [
      {
        dateKey: '8-14-2026',
        displayDate: 'Vendredi 14 Août 2026',
        totalFc: 300000,
        totalDollar: 300000 / 2900,
      },
    ];
    component.toggleUpcomingRequests();
    expect(component.isUpcomingRequestsExpanded).toBeFalse();
  });
});
