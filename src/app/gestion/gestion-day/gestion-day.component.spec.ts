import { GestionDayComponent } from './gestion-day.component';
import { of, Subject } from 'rxjs';

describe('GestionDayComponent optimized audit view', () => {
  const buildTime = () => ({
    getTodaysDateYearMonthDay: () => '2026-08-22',
    todaysDateMonthDayYear: () => '8-22-2026',
    yesterdaysDateMonthDayYear: () => '8-21-2026',
    getTomorrowsDateMonthDayYear: () => '8-23-2026',
    convertDateToDayMonthYear: (date: string) => date,
    convertDateToMonthDayYear: (date: string) => date,
    getDayOfWeek: () => 'Saturday',
  });

  const buildCompute = () => ({
    findTodayTotalResultsGivenField: () => 590000,
    convertCongoleseFrancToUsDollars: (amount: string) =>
      (Number(amount) / 3000).toString(),
    computeExpectedPerDate: (clients: any[]) =>
      clients.reduce((sum, client) => sum + Number(client.amountToPay || 0), 0),
  });

  function createComponent(
    auth: any,
    afs: any = {},
    compute: any = buildCompute(),
    data: any = {}
  ): GestionDayComponent {
    return new GestionDayComponent(
      jasmine.createSpyObj('Router', ['navigate']),
      auth,
      buildTime() as any,
      compute,
      data,
      afs
    );
  }

  it('uses the isolated audit initialization path and preserves the admin path', () => {
    const managementUpdates = new Subject<any[]>();
    const auditAuth = {
      isAdmin: false,
      isDistributor: true,
      isAuditTeamViewer: true,
      managementInfo: { moneyInHands: '250000' },
      weeklyPaymentTarget$: of(600000),
      getManagementInfo: () => managementUpdates.asObservable(),
      getAllUsersInfo: () => of([{ uid: 'audit-location' }]),
    };
    const auditComponent = createComponent(auditAuth);
    spyOn<any>(auditComponent, 'observeDarkModeChanges');
    spyOn(auditComponent, 'initalizeInputs');
    spyOn(auditComponent, 'getAuditOperationalTables');
    spyOn(auditComponent, 'getAllClients');
    spyOn(auditComponent, 'updateReserveGraphics');
    spyOn(auditComponent, 'updateServeGraphics');
    spyOn(auditComponent, 'updateCombinedGraphics');

    auditComponent.ngOnInit();

    expect(auditComponent.initalizeInputs).toHaveBeenCalledTimes(1);
    expect(auditComponent.getAuditOperationalTables).toHaveBeenCalledTimes(1);
    expect(auditComponent.getAllClients).not.toHaveBeenCalled();
    expect(auditComponent.updateReserveGraphics).not.toHaveBeenCalled();
    expect(auditComponent.updateServeGraphics).not.toHaveBeenCalled();
    expect(auditComponent.updateCombinedGraphics).not.toHaveBeenCalled();
    managementUpdates.complete();

    const adminAuth = {
      isAdmin: true,
      isDistributor: false,
      isAuditTeamViewer: false,
      managementInfo: {},
      weeklyPaymentTarget$: of(600000),
      getManagementInfo: () => of([{}]),
      getAllUsersInfo: () => of([{ uid: 'one' }, { uid: 'two' }]),
    };
    const adminComponent = createComponent(adminAuth);
    spyOn<any>(adminComponent, 'observeDarkModeChanges');
    spyOn(adminComponent, 'initalizeInputs');
    spyOn(adminComponent, 'getAuditOperationalTables');
    spyOn(adminComponent, 'getAllClients');
    spyOn(adminComponent, 'updateWeeklyPaymentDate');
    spyOn(adminComponent, 'updateReserveGraphics');
    spyOn(adminComponent, 'updateServeGraphics');
    spyOn(adminComponent, 'updateCombinedGraphics');

    adminComponent.ngOnInit();

    expect(adminComponent.getAuditOperationalTables).not.toHaveBeenCalled();
    expect(adminComponent.getAllClients).toHaveBeenCalledTimes(1);
    expect(adminComponent.updateWeeklyPaymentDate).toHaveBeenCalledTimes(1);
    expect(adminComponent.updateReserveGraphics).toHaveBeenCalledTimes(1);
    expect(adminComponent.updateServeGraphics).toHaveBeenCalledTimes(1);
    expect(adminComponent.updateCombinedGraphics).toHaveBeenCalledTimes(1);
  });

  it('computes the three audit tables from bounded queries and location aggregates', () => {
    const queryLog: Array<{ path: string; field: string; value: string }> = [];
    const queryData: Record<string, any[]> = {
      'users/one/clients|paymentDay|Saturday': [
        {
          debtLeft: '300000',
          paymentDay: 'Saturday',
          amountToPay: '300000',
        },
      ],
      'users/one/clients|requestDate|8-22-2026': [
        {
          requestStatus: 'pending',
          requestDate: '8-22-2026',
          requestType: 'lending',
          agentSubmittedVerification: 'true',
          requestAmount: '90000',
        },
      ],
      'users/one/cards|requestDate|8-22-2026': [],
      'users/two/clients|paymentDay|Saturday': [],
      'users/two/clients|requestDate|8-22-2026': [],
      'users/two/cards|requestDate|8-22-2026': [
        {
          requestStatus: 'pending',
          requestDate: '8-22-2026',
          requestType: 'card',
          requestAmount: '50000',
        },
      ],
    };
    const afs = {
      collection: (path: string, queryFactory: (ref: any) => any) => {
        const descriptor = queryFactory({
          where: (field: string, _operator: string, value: string) => ({
            field,
            value,
          }),
        });
        queryLog.push({ path, field: descriptor.field, value: descriptor.value });
        const key = `${path}|${descriptor.field}|${descriptor.value}`;
        return { valueChanges: () => of(queryData[key] || []) };
      },
    };
    const auth = {
      isAdmin: false,
      isDistributor: true,
      isAuditTeamViewer: true,
    };
    const data = {
      findClientsWithDebts: (clients: any[]) => clients,
      didClientStartThisWeek: () => true,
    };
    const component = createComponent(auth, afs, buildCompute(), data);
    component.theDay = 'Saturday';
    component.dailyReserve = '175000';
    component.allUsers = [
      {
        uid: 'one',
        firstName: 'Masangambila',
        dailyMoneyRequests: { '8-24-2026': '400000' },
        reserve: { '8-22-2026-10-0-0': '175000' },
        moneyInHands: '0',
        cardsMoney: '0',
      },
      {
        uid: 'two',
        firstName: 'Matadikibala',
        dailyMoneyRequests: { '8-24-2026': '100000' },
        reserve: {},
        moneyInHands: '50000',
        cardsMoney: '10000',
      },
    ];

    component.getAuditOperationalTables();

    expect(component.overallTotalToday).toBe(140000);
    expect(component.overallTotal).toBe(500000);
    expect(component.overallTotalReserve).toBe(300000);
    expect(component.overallMoneyInHands).toBe(60000);
    expect(component.userRequestTotals.map((row) => row.total)).toEqual([
      400000,
      100000,
    ]);
    expect(component.userServeTodayTotals.map((row) => row.total)).toEqual([
      90000,
      50000,
    ]);
    expect(component.reserveTotals.map((row) => row.firstName)).toEqual([
      'Masangambila',
      'Matadikibala',
    ]);
    expect(component.reserveTotals[1].moneyInHands).toBe(60000);
    expect(queryLog).toHaveSize(6);
    expect(queryLog.some((query) => query.path.includes('transportReceipts')))
      .toBeFalse();
    expect(
      queryLog.some(
        (query) =>
          query.field === 'requestDate' && query.value === '8-24-2026'
      )
    ).toBeFalse();
  });

  it('queries tomorrow directly only when a location aggregate is absent', () => {
    const queryLog: Array<{ path: string; field: string; value: string }> = [];
    const afs = {
      collection: (path: string, queryFactory: (ref: any) => any) => {
        const descriptor = queryFactory({
          where: (field: string, _operator: string, value: string) => ({
            field,
            value,
          }),
        });
        queryLog.push({ path, field: descriptor.field, value: descriptor.value });
        const isTomorrow = descriptor.value === '8-24-2026';
        const isCard = path.endsWith('/cards');
        const records = isTomorrow
          ? [
              {
                requestStatus: 'pending',
                requestDate: '8-24-2026',
                requestType: isCard ? 'card' : 'savings',
                requestAmount: isCard ? '25000' : '75000',
              },
            ]
          : [];
        return { valueChanges: () => of(records) };
      },
    };
    const component = createComponent(
      { isAdmin: false, isAuditTeamViewer: true },
      afs,
      buildCompute(),
      {
        findClientsWithDebts: (clients: any[]) => clients,
        didClientStartThisWeek: () => true,
      }
    );
    component.theDay = 'Saturday';
    component.allUsers = [
      {
        uid: 'missing',
        firstName: 'Fallback',
        dailyMoneyRequests: {},
        reserve: {},
      },
    ];

    component.getAuditOperationalTables();

    expect(component.overallTotal).toBe(100000);
    expect(
      queryLog.filter(
        (query) =>
          query.field === 'requestDate' && query.value === '8-24-2026'
      )
    ).toHaveSize(2);
  });
});

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
  function createComponent(isAdmin = true, data: any = {}): GestionDayComponent {
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
      data,
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

  it('loads cash-flow history once and reuses it for the combined reserve mode', async () => {
    const data = jasmine.createSpyObj('DataService', [
      'getEmployeeCashPaymentDayTotals',
    ]);
    data.getEmployeeCashPaymentDayTotals.and.resolveTo([
      { dayKey: '7-13-2026', total: 300000, count: 2 },
      { dayKey: '7-20-2026', total: 450000, count: 3 },
    ]);
    const component = createComponent(true, data);
    component.weeklyPaymentDateCorrectFormat = '7-26-2026';
    component.allUsers = [
      {
        uid: 'pumbu',
        firstName: 'Pumbu',
        dailyReimbursement: {
          '7-13-2026': '600000',
          '7-20-2026': '900000',
        },
        reserve: {
          '7-20-2026-9-15-0': '300000',
        },
      } as any,
    ];

    component.updateWeeklyPaymentHistory('1M');
    expect(data.getEmployeeCashPaymentDayTotals).not.toHaveBeenCalled();

    await component.setWeeklyPaymentHistoryMode('cashFlow');

    expect(data.getEmployeeCashPaymentDayTotals).toHaveBeenCalledTimes(1);
    expect(component.graphWeeklyPayments.data).toHaveSize(1);
    expect(component.graphWeeklyPayments.data[0].name).toBe(
      'Paiements cash flow'
    );
    expect(component.graphWeeklyPayments.data[0].customdata.slice(-2)).toEqual([
      [300000, 'Semaine du 13/07/2026 au 19/07/2026', ''],
      [
        450000,
        'Semaine du 20/07/2026 au 26/07/2026',
        '<br><i>Semaine en cours (partielle)</i>',
      ],
    ]);

    await component.setWeeklyPaymentHistoryMode('paymentCashFlowCombined');

    expect(data.getEmployeeCashPaymentDayTotals).toHaveBeenCalledTimes(1);
    expect(
      component.graphWeeklyPayments.data.map((trace: any) => trace.name)
    ).toEqual(['Paiements', 'Paiements cash flow']);

    await component.setWeeklyPaymentHistoryMode('cashFlowCombined');

    expect(data.getEmployeeCashPaymentDayTotals).toHaveBeenCalledTimes(1);
    expect(
      component.graphWeeklyPayments.data.map((trace: any) => trace.name)
    ).toEqual(['Paiements cash flow', 'Réserve']);
    expect(component.graphWeeklyPayments.data[1].y.slice(-1)).toEqual([100]);
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

  it('refreshes a late weekly minimum without recalculating weekly amounts', () => {
    const component = createComponent();
    const targetResolver = spyOn(
      component.auth,
      'resolveWeeklyPaymentTargetForDate'
    ).and.returnValue(600000);
    component.weeklyPaymentDateCorrectFormat = '8-7-2026';
    component.allUsers = [
      {
        uid: 'pumbu',
        firstName: 'Pumbu',
        dailyReimbursement: {
          '8-7-2026': '900000',
        },
      } as any,
    ];
    (component as any).weeklyClientsByUser.set('pumbu', []);

    (component as any).computeWeeklyPaymentTotals();

    expect(component.weeklyPaymentTotals[0].weeklyTargetFc).toBe(600000);
    expect(component.weeklyPaymentTotals[0].weeklyTargetReached).toBeTrue();
    const originalTotal = component.weeklyPaymentTotals[0].total;
    const originalReserve = component.weeklyPaymentTotals[0].weeklyReserveFc;
    const originalExpected = component.weeklyPaymentTotals[0].weeklyExpectedFc;

    targetResolver.and.returnValue(1200000);
    (component as any).refreshWeeklyPaymentTargetCells();

    expect(component.weeklyPaymentTotals[0]).toEqual(
      jasmine.objectContaining({
        weeklyTargetFc: 1200000,
        weeklyTargetReached: false,
        weeklyProgressPercent: 75,
        total: originalTotal,
        weeklyReserveFc: originalReserve,
        weeklyExpectedFc: originalExpected,
      })
    );
  });
});

describe('GestionDayComponent weekly cash-flow toggle', () => {
  function createComponent(getWeeklyTotals: jasmine.Spy): GestionDayComponent {
    const auth = {
      isAdmin: true,
      currentUser: { firstName: 'Admin' },
      resolveWeeklyPaymentTargetForDate: () => 1200,
    };
    const time = {
      getTodaysDateYearMonthDay: () => '2026-08-23',
      todaysDateMonthDayYear: () => '8-23-2026',
      yesterdaysDateMonthDayYear: () => '8-22-2026',
      getTomorrowsDateMonthDayYear: () => '8-24-2026',
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
        (Number(amount) / 2500).toString(),
    };
    const component = new GestionDayComponent(
      jasmine.createSpyObj('Router', ['navigate']),
      auth as any,
      time as any,
      compute as any,
      { getEmployeeWeekTotalsGroupedByTeam: getWeeklyTotals } as any,
      {} as any
    );
    component.weeklyPaymentDate = '2026-08-23';
    component.weeklyPaymentDateCorrectFormat = '8-23-2026';
    component.allUsers = [
      {
        uid: 'pumbu',
        firstName: 'Pumbu',
        dailyReimbursement: { '8-17-2026': '1500' },
      } as any,
      {
        uid: 'matadi',
        firstName: 'Matadikibala',
        dailyReimbursement: { '8-18-2026': '900' },
      } as any,
    ];
    (component as any).weeklyClientsByUser.set('pumbu', []);
    (component as any).weeklyClientsByUser.set('matadi', []);
    (component as any).computeWeeklyPaymentTotals();
    return component;
  }

  it('loads one authoritative weekly query lazily and caches repeated toggles', async () => {
    const getWeeklyTotals = jasmine
      .createSpy('getEmployeeWeekTotalsGroupedByTeam')
      .and.resolveTo([
        { ownerUid: 'pumbu', total: 700, count: 1 },
        { ownerUid: 'matadi', total: 900, count: 2 },
      ]);
    const component = createComponent(getWeeklyTotals);

    expect(component.weeklyPaymentSourceMode).toBe('total');
    expect(getWeeklyTotals).not.toHaveBeenCalled();
    expect(component.displayedWeeklyPaymentTotals[0].firstName).toBe('Pumbu');

    await component.setWeeklyPaymentSourceMode('cashFlow');

    expect(getWeeklyTotals).toHaveBeenCalledOnceWith(
      new Date(2026, 7, 17).getTime(),
      new Date(2026, 7, 23).getTime(),
      ['pumbu', 'matadi']
    );
    expect(
      component.displayedWeeklyPaymentTotals.map((row) => [
        row.firstName,
        row.total,
      ])
    ).toEqual([
      ['Matadikibala', 900],
      ['Pumbu', 700],
    ]);
    expect(component.displayedOverallWeeklyPaymentTotal).toBe(1600);

    await component.setWeeklyPaymentSourceMode('total');
    await component.setWeeklyPaymentSourceMode('cashFlow');

    expect(getWeeklyTotals).toHaveBeenCalledTimes(1);
    expect(component.displayedOverallWeeklyPaymentTotal).toBe(1600);
  });
});

describe('GestionDayComponent weekly payment capture', () => {
  function createComponent(isAdmin = true): GestionDayComponent {
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const auth = { isAdmin };
    const time = {
      getTodaysDateYearMonthDay: () => '2026-08-18',
      todaysDateMonthDayYear: () => '8-18-2026',
      yesterdaysDateMonthDayYear: () => '8-17-2026',
      getTomorrowsDateMonthDayYear: () => '8-19-2026',
      convertDateToDayMonthYear: (date: string) => date,
      toDate: (date: string) => {
        const [month, day, year] = date.split('-').map(Number);
        return new Date(year, month - 1, day);
      },
    };

    const component = new GestionDayComponent(
      router,
      auth as any,
      time as any,
      {} as any,
      {} as any,
      {} as any
    );
    component.weeklyPaymentDate = '2026-08-18';
    component.weeklyPaymentDateCorrectFormat = '8-18-2026';
    component.weeklyPaymentTotals = [{ firstName: 'Pumbu' } as any];
    component.weeklyPaymentCapture = {
      nativeElement: document.createElement('section'),
    } as any;
    return component;
  }

  it('exports the selected Monday-to-Sunday week with a stable filename', async () => {
    const component = createComponent();
    const exportSpy = spyOn<any>(
      component,
      'exportWeeklyPaymentElement'
    ).and.resolveTo();

    await component.captureWeeklyPaymentTable();

    expect(exportSpy).toHaveBeenCalledOnceWith(
      component.weeklyPaymentCapture!.nativeElement,
      'paiement-semaine-2026-08-17-au-2026-08-23.png'
    );
    expect(component.weeklyPaymentCaptureMessage).toBe(
      'Capture téléchargée avec succès.'
    );
    expect(component.weeklyPaymentCaptureError).toBe('');
    expect(component.isCapturingWeeklyPayment).toBeFalse();
  });

  it('blocks duplicate capture work until the current image finishes', async () => {
    const component = createComponent();
    let finishCapture!: () => void;
    const exportSpy = spyOn<any>(
      component,
      'exportWeeklyPaymentElement'
    ).and.returnValue(
      new Promise<void>((resolve) => {
        finishCapture = resolve;
      })
    );

    const firstCapture = component.captureWeeklyPaymentTable();
    await component.captureWeeklyPaymentTable();

    expect(component.isCapturingWeeklyPayment).toBeTrue();
    expect(exportSpy).toHaveBeenCalledTimes(1);

    finishCapture();
    await firstCapture;

    expect(component.isCapturingWeeklyPayment).toBeFalse();
  });

  it('exports a compact ranking with its own stable filename', async () => {
    const component = createComponent();
    const exportSpy = spyOn<any>(
      component,
      'exportWeeklyPaymentRankingElement'
    ).and.resolveTo();

    await component.captureWeeklyPaymentRanking();

    expect(exportSpy).toHaveBeenCalledOnceWith(
      component.weeklyPaymentCapture!.nativeElement,
      'classement-paiement-semaine-2026-08-17-au-2026-08-23.png'
    );
    expect(component.weeklyPaymentCaptureMessage).toBe(
      'Capture du classement téléchargée avec succès.'
    );
    expect(component.weeklyPaymentCaptureError).toBe('');
    expect(component.isCapturingWeeklyPaymentRanking).toBeFalse();
  });

  it('computes the compact total progress from all weekly targets', () => {
    const component = createComponent();
    component.weeklyPaymentTotals = [
      { weeklyTargetFc: 600000 } as any,
      { weeklyTargetFc: 900000 } as any,
    ];
    component.overallWeeklyPaymentTotal = 750000;

    expect(component.overallWeeklyTargetTotal).toBe(1500000);
    expect(component.overallWeeklyTargetProgressPercent).toBe(50);
    expect(component.overallWeeklyTargetProgressTone).toBe('yellow');
  });

  it('uses ranking by default and captures whichever view is selected', async () => {
    const component = createComponent();
    const rankingSpy = spyOn(component, 'captureWeeklyPaymentRanking').and.resolveTo();
    const detailedSpy = spyOn(component, 'captureWeeklyPaymentTable').and.resolveTo();

    expect(component.weeklyPaymentViewMode).toBe('ranking');
    await component.captureWeeklyPaymentView();
    expect(rankingSpy).toHaveBeenCalledTimes(1);
    expect(detailedSpy).not.toHaveBeenCalled();

    component.weeklyPaymentViewMode = 'detailed';
    await component.captureWeeklyPaymentView();
    expect(detailedSpy).toHaveBeenCalledTimes(1);
  });

  it('restores the action and reports a rendering failure', async () => {
    const component = createComponent();
    spyOn(console, 'error');
    spyOn<any>(component, 'exportWeeklyPaymentElement').and.rejectWith(
      new Error('canvas unavailable')
    );

    await component.captureWeeklyPaymentTable();

    expect(component.isCapturingWeeklyPayment).toBeFalse();
    expect(component.weeklyPaymentCaptureMessage).toBe('');
    expect(component.weeklyPaymentCaptureError).toBe(
      'Impossible de générer la capture. Veuillez réessayer.'
    );
    expect(console.error).toHaveBeenCalled();
  });

  it('does not expose capture work to non-admin viewers', async () => {
    const component = createComponent(false);
    const exportSpy = spyOn<any>(
      component,
      'exportWeeklyPaymentElement'
    ).and.resolveTo();

    await component.captureWeeklyPaymentTable();

    expect(exportSpy).not.toHaveBeenCalled();
  });

  it('shows a useful message when the selected week has no teams', async () => {
    const component = createComponent();
    component.weeklyPaymentTotals = [];
    const exportSpy = spyOn<any>(
      component,
      'exportWeeklyPaymentElement'
    ).and.resolveTo();

    await component.captureWeeklyPaymentTable();

    expect(exportSpy).not.toHaveBeenCalled();
    expect(component.weeklyPaymentCaptureError).toBe(
      'Aucune équipe n’est disponible pour cette semaine.'
    );
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
