import { of } from 'rxjs';
import { TodayCentralComponent } from './today-central.component';

describe('TodayCentralComponent management hydration', () => {
  it('accepts the compatibility stream without changing the page contract', () => {
    const management = { id: 'management-1', reserve: { old: '10' } };
    const auth = {
      getManagementInfo: () => of([management]),
      getAllUsersInfo: () => of([]),
    };
    const time = {
      getTomorrowsDateMonthDayYear: () => '8-15-2026',
      todaysDateMonthDayYear: () => '8-14-2026',
      convertDateToDayMonthYear: (value: string) => value,
      getTodaysDateYearMonthDay: () => '2026-08-14',
    };
    const component = new TodayCentralComponent(
      {} as any,
      auth as any,
      time as any,
      {} as any,
      {} as any
    );
    spyOn(component, 'initalizeInputs');
    spyOn<any>(component, 'loadAuditPaymentPerformance');

    component.ngOnInit();

    expect(component.managementInfo).toBe(management as any);
    expect(component.allUsers).toEqual([]);
    expect(component.initalizeInputs).toHaveBeenCalled();
  });

  it('loads and caches one admin cash-flow ranking without using team aggregates', async () => {
    const cashFlowTotals = jasmine
      .createSpy('getEmployeeDayTotalsGroupedByTeamForDays')
      .and.resolveTo([
        { dayKey: '8-19-2026', ownerUid: 'site-a', total: 200, count: 1 },
        { dayKey: '8-19-2026', ownerUid: 'site-b', total: 300, count: 1 },
        { dayKey: '8-20-2026', ownerUid: 'site-a', total: 400, count: 1 },
        { dayKey: '8-20-2026', ownerUid: 'site-b', total: 450, count: 1 },
        { dayKey: '8-21-2026', ownerUid: 'site-a', total: 600, count: 1 },
        { dayKey: '8-21-2026', ownerUid: 'site-b', total: 700, count: 1 },
        { dayKey: '8-22-2026', ownerUid: 'site-a', total: 1000, count: 2 },
        { dayKey: '8-22-2026', ownerUid: 'site-b', total: 900, count: 3 },
      ]);
    const auth = {
      isAdmin: true,
      currentUser: { uid: 'admin-1' },
    };
    const time = {
      getTomorrowsDateMonthDayYear: () => '8-23-2026',
      todaysDateMonthDayYear: () => '8-22-2026',
      convertDateToDayMonthYear: (value: string) => value,
      getTodaysDateYearMonthDay: () => '2026-08-22',
    };
    const compute = {
      convertCongoleseFrancToUsDollars: (value: string) =>
        (Number(value) / 2500).toString(),
    };
    const component = new TodayCentralComponent(
      {} as any,
      auth as any,
      time as any,
      compute as any,
      { getEmployeeDayTotalsGroupedByTeamForDays: cashFlowTotals } as any
    );
    component.allUsers = [
      {
        uid: 'site-a',
        firstName: 'Alpha',
        // The location aggregate includes an extra savings transfer. The
        // ranking must use the employee totals returned above instead.
        dailyReimbursement: { '8-22-2026': '1500' },
      } as any,
      {
        uid: 'site-b',
        firstName: 'Beta',
        dailyReimbursement: { '8-22-2026': '900' },
      } as any,
    ];

    await (component as any).loadCashFlowPaymentRanking();
    await (component as any).loadCashFlowPaymentRanking();

    expect(cashFlowTotals).toHaveBeenCalledTimes(1);
    expect(cashFlowTotals).toHaveBeenCalledWith(
      ['8-19-2026', '8-20-2026', '8-21-2026', '8-22-2026'],
      ['site-a', 'site-b']
    );
    expect(component.cashFlowPaymentRows.map((row) => row.firstName)).toEqual([
      'Alpha',
      'Beta',
    ]);
    expect(component.cashFlowPaymentRows[0].totalPayment).toBe(1000);
    expect(component.cashFlowPaymentTotalFc).toBe(1900);
    expect(component.cashFlowPaymentTotalDollars).toBeCloseTo(0.76, 5);
    expect(component.cashFlowPaymentMaxFc).toBe(1000);
    expect(component.heroSnapshot[1]).toEqual({
      label: 'Paiement cash flow',
      value: 1900,
      valueUsd: 0.76,
      icon: '💰',
    });
    expect(component.todaySummaryCards[1]).toEqual(
      jasmine.objectContaining({
        index: 1,
        title: 'Paiement Cash Flow Du Jour',
        amountFc: 1900,
        amountUsd: 0.76,
        link: '/daily-payments',
      })
    );
    expect(component.getMiniCashFlowPaymentGraph('site-a').data.length).toBe(1);
    expect(
      component.getMiniCashFlowPaymentGraph('site-a').data[0].customdata
    ).toEqual([0.08, 0.16, 0.24, 0.4]);
  });

  it('never requests or retains the cash-flow ranking for a non-admin', async () => {
    const cashFlowTotals = jasmine.createSpy(
      'getEmployeeDayTotalsGroupedByTeamForDays'
    );
    const component = new TodayCentralComponent(
      {} as any,
      { isAdmin: false } as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-23-2026',
        todaysDateMonthDayYear: () => '8-22-2026',
        convertDateToDayMonthYear: (value: string) => value,
        getTodaysDateYearMonthDay: () => '2026-08-22',
      } as any,
      { convertCongoleseFrancToUsDollars: () => '0' } as any,
      { getEmployeeDayTotalsGroupedByTeamForDays: cashFlowTotals } as any
    );
    component.allUsers = [{ uid: 'site-a', firstName: 'Alpha' } as any];
    component.cashFlowPaymentRows = [
      {
        teamId: 'stale',
        firstName: 'Stale',
        totalPayment: 1,
        totalPaymentInDollars: 1,
        paymentCount: 1,
      },
    ];

    await (component as any).loadCashFlowPaymentRanking();

    expect(cashFlowTotals).not.toHaveBeenCalled();
    expect(component.cashFlowPaymentRows).toEqual([]);
    expect(component.cashFlowPaymentTotalFc).toBe(0);
  });

  it('copies the daily cash-flow ranking with the payment-table format', async () => {
    const component = new TodayCentralComponent(
      {} as any,
      { isAdmin: true } as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-23-2026',
        todaysDateMonthDayYear: () => '8-22-2026',
        convertDateToDayMonthYear: (value: string) => value,
        getTodaysDateYearMonthDay: () => '2026-08-22',
        englishToFrenchDay: { Saturday: 'Samedi' },
      } as any,
      {} as any,
      {} as any
    );
    component.cashFlowPaymentRows = [
      {
        teamId: 'site-a',
        firstName: 'Alpha',
        totalPayment: 1000,
        totalPaymentInDollars: 0.4,
        paymentCount: 2,
      },
      {
        teamId: 'site-b',
        firstName: 'Beta',
        totalPayment: 900,
        totalPaymentInDollars: 0.36,
        paymentCount: 3,
      },
    ];
    spyOn<any>(component, 'buildWinnerMembersLines').and.resolveTo([
      'Avec Alice et Bob',
    ]);
    const copyToClipboard = spyOn<any>(
      component,
      'copyToClipboard'
    ).and.resolveTo();

    await component.copyCashFlowPaymentRanking();

    expect(copyToClipboard).toHaveBeenCalledOnceWith(
      [
        'Samedi 22/8/2026',
        '===============',
        '1. Equipe Gagnante:  Alpha',
        'Avec Alice et Bob',
        '2. Beta',
      ].join('\n')
    );
    expect(component.copyCashFlowPaymentsMessage).toBe(
      'Classement copié (montants exclus)'
    );
  });
});
