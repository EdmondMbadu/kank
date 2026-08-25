import { of } from 'rxjs';
import { GestionMonthComponent } from './gestion-month.component';

describe('GestionMonthComponent management hydration', () => {
  const buildTime = () => ({
    yearsList: [2026],
    monthFrenchNames: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août'],
    todaysDateMonthDayYear: () => '8-14-2026',
  });

  const buildCompute = () => ({
    quarter1: 1,
    getMonthNameFrench: () => 'Août',
    convertCongoleseFrancToUsDollars: (value: string) =>
      (Number(value) / 3000).toString(),
  });

  const createComponent = (auth: any, data: any = {}) =>
    new GestionMonthComponent(
      {} as any,
      auth,
      buildTime() as any,
      buildCompute() as any,
      data
    );

  it('receives reconstructed history through the unchanged AuthService API', () => {
    const management = { id: 'management-1', reserve: { old: '10' } };
    const auth = {
      isAdmin: false,
      getManagementInfo: () => of([management]),
      getAllUsersInfo: () => of([]),
    };
    const time = {
      yearsList: [2026],
      todaysDateMonthDayYear: () => '8-14-2026',
    };
    const compute = {
      quarter1: 1,
      getMonthNameFrench: () => 'Août',
    };
    const component = new GestionMonthComponent(
      {} as any,
      auth as any,
      time as any,
      compute as any,
      {} as any
    );
    spyOn(component, 'initalizeInputs');
    spyOn(component, 'updateReserveGraphics');

    component.ngOnInit();

    expect(component.managementInfo).toBe(management as any);
    expect(component.initalizeInputs).toHaveBeenCalled();
    expect(component.updateReserveGraphics).toHaveBeenCalled();
  });

  it('loads and caches one monthly pure-payment query for every admin team', async () => {
    const getMonthlyPurePayments = jasmine
      .createSpy('getEmployeeMonthTotalsGroupedByTeam')
      .and.resolveTo([
        { ownerUid: 'one', total: 398750, count: 4 },
        { ownerUid: 'two', total: 101250, count: 2 },
      ]);
    const component = createComponent(
      { isAdmin: true },
      { getEmployeeMonthTotalsGroupedByTeam: getMonthlyPurePayments }
    );
    component.allUsers = [
      { uid: 'one', firstName: 'Masangambila' } as any,
      { uid: 'two', firstName: 'Matadikibala' } as any,
    ];
    component.monthlyPaymentTotals = [
      {
        trackingId: 'one',
        firstName: 'Masangambila',
        expectedFc: 500000,
      } as any,
      {
        trackingId: 'two',
        firstName: 'Matadikibala',
        expectedFc: 500000,
      } as any,
    ];
    component.overallMonthlyExpectedTotal = 1000000;

    await (component as any).loadMonthlyPurePayments();
    await (component as any).loadMonthlyPurePayments();

    expect(getMonthlyPurePayments).toHaveBeenCalledOnceWith('2026-08', [
      'one',
      'two',
    ]);
    expect(
      component.monthlyPaymentTotals.map((row) => row.purePaymentFc)
    ).toEqual([398750, 101250]);
    expect(component.overallMonthlyPurePaymentTotal).toBe(500000);
    expect(component.overallMonthlyPurePaymentTotalDollar).toBeCloseTo(
      166.6667,
      3
    );
    expect(
      component.monthlyPaymentTotals[0].purePaymentExpectedProgressPercent
    ).toBeCloseTo(79.75, 2);
    expect(component.overallMonthlyPurePaymentExpectedProgressPercent).toBe(
      50
    );
  });

  it('never requests or retains monthly pure payments for a non-admin', async () => {
    const getMonthlyPurePayments = jasmine.createSpy(
      'getEmployeeMonthTotalsGroupedByTeam'
    );
    const component = createComponent(
      { isAdmin: false },
      { getEmployeeMonthTotalsGroupedByTeam: getMonthlyPurePayments }
    );
    component.allUsers = [{ uid: 'one' } as any];
    component.monthlyPaymentTotals = [
      {
        trackingId: 'one',
        firstName: 'Masangambila',
        purePaymentFc: 100,
        purePaymentDollar: 1,
      } as any,
    ];
    component.overallMonthlyPurePaymentTotal = 100;

    await (component as any).loadMonthlyPurePayments();

    expect(getMonthlyPurePayments).not.toHaveBeenCalled();
    expect(component.monthlyPaymentTotals[0].purePaymentFc).toBe(0);
    expect(component.overallMonthlyPurePaymentTotal).toBe(0);
  });

  it('reuses one client snapshot when the selected month changes', () => {
    const auth = {
      isAdmin: true,
      getClientsOfAUser: jasmine
        .createSpy('getClientsOfAUser')
        .and.callFake((uid: string) => of([{ uid: `client-${uid}` }])),
    };
    const component = createComponent(auth);
    component.allUsers = [{ uid: 'one' } as any, { uid: 'two' } as any];
    spyOn<any>(component, 'loadMonthlyPurePayments').and.resolveTo();
    const computeTotals = spyOn<any>(
      component,
      'computeMonthlyPaymentTotals'
    );

    component.loadMonthlyPaymentTotals();
    component.givenMonth = 7;
    component.loadMonthlyPaymentTotals();

    expect(auth.getClientsOfAUser).toHaveBeenCalledTimes(2);
    expect(computeTotals).toHaveBeenCalledTimes(2);
  });
});
