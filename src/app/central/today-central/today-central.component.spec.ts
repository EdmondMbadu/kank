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
      .createSpy('getEmployeeDayTotalsGroupedByTeam')
      .and.resolveTo([
        { ownerUid: 'site-a', total: 1000, count: 2 },
        { ownerUid: 'site-b', total: 900, count: 3 },
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
      { getEmployeeDayTotalsGroupedByTeam: cashFlowTotals } as any
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
    expect(cashFlowTotals).toHaveBeenCalledWith('8-22-2026', [
      'site-a',
      'site-b',
    ]);
    expect(component.cashFlowPaymentRows.map((row) => row.firstName)).toEqual([
      'Alpha',
      'Beta',
    ]);
    expect(component.cashFlowPaymentRows[0].totalPayment).toBe(1000);
    expect(component.cashFlowPaymentTotalFc).toBe(1900);
    expect(component.cashFlowPaymentTotalDollars).toBeCloseTo(0.76, 5);
    expect(component.cashFlowPaymentMaxFc).toBe(1000);
  });

  it('never requests or retains the cash-flow ranking for a non-admin', async () => {
    const cashFlowTotals = jasmine.createSpy(
      'getEmployeeDayTotalsGroupedByTeam'
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
      { getEmployeeDayTotalsGroupedByTeam: cashFlowTotals } as any
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
});
