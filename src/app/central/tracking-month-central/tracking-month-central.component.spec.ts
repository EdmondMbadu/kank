import { TrackingMonthCentralComponent } from './tracking-month-central.component';

describe('TrackingMonthCentralComponent', () => {
  const createComponent = (
    isAdmin: boolean,
    getEmployeeMonthTotalsGroupedByTeam: jasmine.Spy
  ) =>
    new TrackingMonthCentralComponent(
      { isAdmin } as any,
      {
        yearsList: [2025, 2026],
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
        todaysDateMonthDayYear: () => '8-22-2026',
      } as any,
      {
        getMonthNameFrench: () => 'Août',
        convertCongoleseFrancToUsDollars: (value: string) =>
          (Number(value) / 2500).toString(),
      } as any,
      { getEmployeeMonthTotalsGroupedByTeam } as any
    );

  it('loads, ranks and caches the monthly admin cash-flow totals', async () => {
    const getMonthlyTotals = jasmine
      .createSpy('getEmployeeMonthTotalsGroupedByTeam')
      .and.resolveTo([
        { ownerUid: 'site-a', total: 1000, count: 2 },
        { ownerUid: 'site-b', total: 900, count: 3 },
      ]);
    const component = createComponent(true, getMonthlyTotals);
    component.paymentCurrentMonth = 8;
    component.paymentCurrentYear = 2026;
    component.allUsers = [
      {
        uid: 'site-a',
        firstName: 'Alpha',
        // Includes an extra savings transfer. The ranking must use the
        // employee cash totals returned by the dedicated query instead.
        dailyReimbursement: { '8-1-2026': '1500' },
      } as any,
      {
        uid: 'site-b',
        firstName: 'Beta',
        dailyReimbursement: { '8-2-2026': '900' },
      } as any,
    ];

    await (component as any).loadCashFlowMonthRanking();
    await (component as any).loadCashFlowMonthRanking();

    expect(getMonthlyTotals).toHaveBeenCalledTimes(1);
    expect(getMonthlyTotals).toHaveBeenCalledWith('2026-08', [
      'site-a',
      'site-b',
    ]);
    expect(component.cashFlowMonthRows.map((row) => row.firstName)).toEqual([
      'Alpha',
      'Beta',
    ]);
    expect(component.cashFlowMonthRows[0].totalPayment).toBe(1000);
    expect(component.cashFlowMonthTotalFc).toBe(1900);
    expect(component.cashFlowMonthTotalDollars).toBeCloseTo(0.76, 5);
    expect(component.cashFlowMonthMaxFc).toBe(1000);
  });

  it('does not request or retain monthly cash-flow totals for a non-admin', async () => {
    const getMonthlyTotals = jasmine.createSpy(
      'getEmployeeMonthTotalsGroupedByTeam'
    );
    const component = createComponent(false, getMonthlyTotals);
    component.paymentCurrentMonth = 8;
    component.paymentCurrentYear = 2026;
    component.allUsers = [{ uid: 'site-a', firstName: 'Alpha' } as any];
    component.cashFlowMonthRows = [
      {
        teamId: 'stale',
        firstName: 'Stale',
        totalPayment: 1,
        totalPaymentInDollars: 1,
        paymentCount: 1,
      },
    ];

    await (component as any).loadCashFlowMonthRanking();

    expect(getMonthlyTotals).not.toHaveBeenCalled();
    expect(component.cashFlowMonthRows).toEqual([]);
    expect(component.cashFlowMonthTotalFc).toBe(0);
  });

  it('copies the monthly cash-flow ranking with the payment-table format', async () => {
    const component = createComponent(
      true,
      jasmine.createSpy('getEmployeeMonthTotalsGroupedByTeam')
    );
    component.paymentCurrentMonth = 8;
    component.paymentCurrentYear = 2026;
    component.cashFlowMonthRows = [
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
        'Resultats Août 2026',
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
