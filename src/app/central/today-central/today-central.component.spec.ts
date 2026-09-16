import { of, Subject, throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { TimeService } from '../../services/time.service';
import { ComputationService } from '../../shrink/services/computation.service';
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

describe('TodayCentralComponent on-demand daily details', () => {
  let component: TodayCentralComponent;
  let getClients: jasmine.Spy;
  let getCashPayments: jasmine.Spy;

  beforeEach(() => {
    getCashPayments = jasmine.createSpy('getEmployeeCashPaymentsForDay').and.callFake(async (dayKey: string) => [
      { id: 'cash-b', ownerUid: 'site-b', clientUid: 'b', fullName: 'Paul', dayKey,
        amount: 200, createdAtMs: 1, source: 'manual' },
      { id: 'cash-a', ownerUid: 'site-a', clientUid: 'a', fullName: 'Ésther', dayKey,
        amount: 100, createdAtMs: 2, source: 'mobile_money' },
    ]);
    getClients = jasmine.createSpy('getClientsOfAUserForMonth').and.callFake((uid: string) => of([{
      uid: 'client-a', firstName: uid === 'site-a' ? 'Ésther' : 'Paul',
      locationName: 'Old location', locationOwnerId: 'old-owner',
      payments: { '9-1-2026-8-0-0': '100', '9-2-2026-8-0-0': '200' },
      previousPayments: { '9-1-2026-7-0-0': '50' },
      debtCycleStartDate: '9-1-2026', loanAmount: '1000',
    }]));
    component = new TodayCentralComponent({} as any, {
      isAdmin: true, getClientsOfAUserForMonth: getClients,
      getAllUsersInfo: () => of([]), getManagementInfo: () => of([]),
    } as any, {
      getTomorrowsDateMonthDayYear: () => '9-2-2026',
      todaysDateMonthDayYear: () => '9-1-2026',
      convertDateToDayMonthYear: (value: string) => value,
      convertDateToMonthDayYear: () => '9-2-2026',
      getTodaysDateYearMonthDay: () => '2026-09-01',
    } as any, {} as any, { getEmployeeCashPaymentsForDay: getCashPayments } as any);
    component.allUsers = [
      { uid: 'site-b', firstName: 'Zongo', dailyReimbursement: { '9-1-2026': '150' } },
      { uid: 'site-a', firstName: 'Bandal', dailyReimbursement: { '9-1-2026': '150' } },
    ];
  });

  afterEach(() => component.ngOnDestroy());

  async function open(index = 0) {
    component.openDailyActivityModal(index);
    // Joining a pending load must not launch another set of reads.
    await component.loadDailyActivityDetails();
  }

  it('adds no detail reads to page initialization and leaves unrelated cards unchanged', () => {
    spyOn(component, 'initalizeInputs');
    spyOn<any>(component, 'loadCashFlowPaymentRanking');
    spyOn<any>(component, 'loadAuditPaymentPerformance');
    component.ngOnInit();
    expect(getClients).not.toHaveBeenCalled();
    expect(getCashPayments).not.toHaveBeenCalled();
    [2, 4, 8].forEach((index) => {
      expect(component.isDailyActivityCard(index)).toBeFalse();
      component.openDailyActivityModal(index);
    });
    expect(component.isDailyActivityModalOpen).toBeFalse();
    expect(getClients).not.toHaveBeenCalled();
  });

  it('opens cash flow from its own ledger, sorts by site, and reuses local filters and cached day data', async () => {
    component.cashFlowPaymentTotalFc = 300;
    await open(1);
    expect(component.dailyActivityKind).toBe('cash-payment');
    expect(component.dailyActivityTitle).toBe('Paiements cash flow du jour');
    expect(component.dailyActivityCentralTotal).toBe(300);
    expect(component.dailyActivityTotal).toBe(300);
    expect(component.dailyActivityPageGroups.map((site) => site.name)).toEqual(['Bandal', 'Zongo']);
    expect(getCashPayments).toHaveBeenCalledOnceWith('9-1-2026', ['site-b', 'site-a']);
    expect(getClients).not.toHaveBeenCalled();
    component.dailyActivitySearch = 'esther';
    component.applyDailyActivityFilters();
    expect(component.dailyActivityFilteredTotal).toBe(100);
    component.dailyActivitySiteFilter = 'site-b';
    component.applyDailyActivityFilters();
    expect(component.dailyActivityFilteredRows.length).toBe(0);
    component.closeDailyActivityModal();
    await open(0);
    await open(1);
    expect(getCashPayments).toHaveBeenCalledTimes(1);
    expect(component.dailyActivityTotal).toBe(300);
  });

  it('invalidates cash details on refresh, selected-day aggregate changes, and day switches only', async () => {
    await open(1);
    await component.loadDailyActivityDetails(true);
    expect(getCashPayments).toHaveBeenCalledTimes(2);
    component.allUsers.reverse();
    component.allUsers[0].dailyReimbursement!['8-1-2026'] = '999';
    await open(1);
    expect(getCashPayments).toHaveBeenCalledTimes(2);
    component.allUsers[0].dailyReimbursement!['9-1-2026'] = '999';
    await open(1);
    expect(getCashPayments).toHaveBeenCalledTimes(3);
    component.requestDateCorrectFormat = '9-2-2026';
    await component.loadDailyActivityDetails();
    expect(getCashPayments).toHaveBeenCalledTimes(4);
    expect(component.dailyActivityRows.every((row) => row.dateLabel === '02/09/2026')).toBeTrue();
    expect((component as any).dailyCashActivityCache.size).toBe(2);
  });

  it('shows no partial cash list after failed reads and retries instead of caching failure', async () => {
    getCashPayments.and.rejectWith(new Error('offline'));
    await open(1);
    expect(component.dailyActivityRows).toEqual([]);
    expect(component.dailyActivityError).toContain('aucune liste partielle');
    expect(component.dailyActivityLoading).toBeFalse();
    getCashPayments.and.resolveTo([]);
    await component.loadDailyActivityDetails(true);
    expect(component.dailyActivityError).toBe('');
    expect(getCashPayments).toHaveBeenCalledTimes(2);
  });

  it('does not let a delayed cash response overwrite loans or a closed modal', async () => {
    let resolve!: (payments: any[]) => void;
    getCashPayments.and.returnValue(new Promise<any[]>((done) => resolve = done));
    component.openDailyActivityModal(1);
    const pending = component.loadDailyActivityDetails();
    await open(3);
    resolve([{ id: 'late', ownerUid: 'site-a', clientUid: 'a', fullName: 'Late',
      dayKey: '9-1-2026', amount: 999, createdAtMs: 1, source: 'manual' }]);
    await pending;
    expect(component.dailyActivityKind).toBe('lending');
    expect(component.dailyActivityTotal).toBe(2000);
    expect(component.dailyActivityRows.some((row) => row.fullName === 'Late')).toBeFalse();
    component.requestDateCorrectFormat = '9-2-2026';
    getCashPayments.and.returnValue(new Promise<any[]>((done) => resolve = done));
    component.openDailyActivityModal(1);
    const closedPending = component.loadDailyActivityDetails();
    component.closeDailyActivityModal();
    resolve([]);
    await closedPending;
    expect(component.isDailyActivityModalOpen).toBeFalse();
    expect(component.dailyActivityLoading).toBeFalse();
  });

  it('keeps cash flow details admin-only, matching the cash flow ranking', () => {
    (component.auth as any).isAdmin = false;
    expect(component.isDailyActivityCard(1)).toBeFalse();
    component.openDailyActivityModal(1);
    expect(component.isDailyActivityModalOpen).toBeFalse();
    expect(getCashPayments).not.toHaveBeenCalled();
  });

  it('shares one cached monthly snapshot between payment/loan modals and date switches', async () => {
    await open();
    expect(getClients).toHaveBeenCalledTimes(2);
    expect(getClients).toHaveBeenCalledWith('site-a', '2026-09');
    expect(component.dailyActivityRows.length).toBe(4);
    expect(component.dailyActivityTotal).toBe(300);
    expect(component.dailyActivityPageGroups.map((site) => site.name)).toEqual(['Bandal', 'Zongo']);
    expect(component.dailyActivityRows[0].locationId).toBe('site-a');
    component.closeDailyActivityModal();
    await open(3);
    expect(component.dailyActivityTotal).toBe(2000);
    expect(component.dailyActivityRows.length).toBe(2);
    expect(getClients).toHaveBeenCalledTimes(2);
    component.closeDailyActivityModal();
    component.requestDateCorrectFormat = '9-2-2026';
    await open();
    expect(component.dailyActivityTotal).toBe(400);
    expect(getClients).toHaveBeenCalledTimes(2);
  });

  it('filters accent-insensitively by name and exact site id without database reads', async () => {
    await open();
    component.dailyActivitySearch = 'esther';
    component.applyDailyActivityFilters();
    expect(component.dailyActivityFilteredRows.length).toBe(2);
    expect(component.dailyActivityFilteredTotal).toBe(150);
    component.dailyActivitySiteFilter = 'site-b';
    component.applyDailyActivityFilters();
    expect(component.dailyActivityFilteredRows).toEqual([]);
    component.resetDailyActivityFilters();
    expect(component.dailyActivityFilteredTotal).toBe(300);
    expect(getClients).toHaveBeenCalledTimes(2);
  });

  it('bounds rendered rows, keeps full site totals across pages, and clamps page navigation', async () => {
    getClients.and.returnValue(of(Array.from({ length: 120 }, (_, index) => ({
      uid: `client-${index}`, payments: { '9-1-2026': '100' },
    }))));
    component.allUsers = [component.allUsers[0]];
    await open();
    expect(component.dailyActivityRows.length).toBe(120);
    expect(component.dailyActivityPageGroups[0].rows.length).toBe(50);
    expect(component.dailyActivityPageGroups[0].total).toBe(12000);
    expect(component.dailyActivityPageCount).toBe(3);
    component.changeDailyActivityPage(99);
    expect(component.dailyActivityPage).toBe(3);
    expect(component.dailyActivityPageGroups[0].rows.length).toBe(20);
    component.changeDailyActivityPage(-99);
    expect(component.dailyActivityPage).toBe(1);
    expect(getClients).toHaveBeenCalledTimes(1);
  });

  it('refreshes explicitly and invalidates the cache when relevant location aggregates change', async () => {
    await open();
    await component.loadDailyActivityDetails(true);
    expect(getClients).toHaveBeenCalledTimes(4);
    component.allUsers[0].dailyReimbursement!['9-1-2026'] = '250';
    await component.loadDailyActivityDetails();
    expect(getClients).toHaveBeenCalledTimes(6);
  });

  it('does not invalidate the snapshot for unrelated months or user ordering', async () => {
    await open();
    component.allUsers.reverse();
    component.allUsers[0].dailyReimbursement!['8-1-2026'] = '999';
    await component.loadDailyActivityDetails();
    expect(getClients).toHaveBeenCalledTimes(2);
  });

  it('does not display a partial list when one site fails, and retries successfully', async () => {
    spyOn(console, 'error');
    getClients.and.callFake((uid: string) => uid === 'site-a'
      ? throwError(() => new Error('Network unavailable')) : of([{ uid: 'b', payments: { '9-1-2026': '100' } }]));
    await open();
    expect(component.dailyActivityError).toContain('aucune liste partielle');
    expect(component.dailyActivityRows).toEqual([]);
    expect(component.dailyActivityLoading).toBeFalse();
    getClients.and.returnValue(of([{ uid: 'a', payments: { '9-1-2026': '100' } }]));
    await component.loadDailyActivityDetails(true);
    expect(component.dailyActivityError).toBe('');
    expect(component.dailyActivityTotal).toBe(200);
  });

  it('cancels outstanding site readers when another site fails', async () => {
    spyOn(console, 'error');
    const waitingSite = new Subject<any[]>();
    getClients.and.callFake((uid: string) => uid === 'site-b' ? waitingSite
      : throwError(() => new Error('Denied')));
    await open();
    expect(waitingSite.observed).toBeFalse();
    expect(component.dailyActivityError).not.toBe('');
  });

  it('ignores a completed request after closing the dialog and reuses it upon reopening', async () => {
    const clients = new Subject<any[]>();
    getClients.and.returnValue(clients);
    component.openDailyActivityModal(0);
    const load = component.loadDailyActivityDetails();
    component.closeDailyActivityModal();
    clients.next([{ uid: 'a', payments: { '9-1-2026': '100' } }]);
    await load;
    expect(component.isDailyActivityModalOpen).toBeFalse();
    expect(component.dailyActivityRows).toEqual([]);
    await open();
    expect(component.dailyActivityTotal).toBe(200);
    expect(getClients).toHaveBeenCalledTimes(2);
  });

  it('applies the latest selected date if the day changes during loading', async () => {
    const clients = new Subject<any[]>();
    getClients.and.returnValue(clients);
    component.openDailyActivityModal(0);
    const oldLoad = component.loadDailyActivityDetails();
    component.requestDateCorrectFormat = '9-2-2026';
    const newLoad = component.loadDailyActivityDetails();
    clients.next([{ uid: 'a', payments: { '9-1-2026': '100', '9-2-2026': '200' } }]);
    await Promise.all([oldLoad, newLoad]);
    expect(component.dailyActivityTotal).toBe(400);
    expect(component.dailyActivityRows.every((row) => row.dateLabel === '02/09/2026')).toBeTrue();
    expect(getClients).toHaveBeenCalledTimes(2);
  });

  it('ignores an older month that finishes after the new month and bounds cached snapshots', async () => {
    const september = new Subject<any[]>();
    getClients.and.callFake((_uid: string, month: string) => month === '2026-09' ? september
      : of([{ uid: 'a', payments: { '10-1-2026': '300' } }]));
    component.openDailyActivityModal(0);
    const oldLoad = component.loadDailyActivityDetails();
    component.requestDateCorrectFormat = '10-1-2026';
    await component.loadDailyActivityDetails();
    expect(component.dailyActivityTotal).toBe(600);
    september.next([{ uid: 'a', payments: { '9-1-2026': '100' } }]);
    await oldLoad;
    expect(component.dailyActivityTotal).toBe(600);
    component.requestDateCorrectFormat = '11-1-2026';
    await component.loadDailyActivityDetails();
    expect((component as any).dailyActivityCache.size).toBe(2);
    expect(getClients).toHaveBeenCalledTimes(6);
  });

  it('filters sites by owner id even if two locations have the same displayed name', async () => {
    component.allUsers.forEach((user) => user.firstName = 'Même site');
    await open();
    expect(component.dailyActivitySiteOptions.length).toBe(2);
    component.dailyActivitySiteFilter = 'site-a';
    component.applyDailyActivityFilters();
    expect(component.dailyActivityFilteredRows.length).toBe(2);
    expect(component.dailyActivityFilteredRows.every((row) => row.locationId === 'site-a')).toBeTrue();
  });

  it('reloads details for the selected date without changing the existing date calculation path', async () => {
    await open();
    const initialize = spyOn(component, 'initalizeInputs');
    spyOn<any>(component, 'loadCashFlowPaymentRanking');
    spyOn<any>(component, 'computeAuditPaymentPerformanceRows');
    component.findDailyActivitiesCentralAmount();
    await component.loadDailyActivityDetails();
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(component.requestDateCorrectFormat).toBe('9-2-2026');
    expect(component.dailyActivityTotal).toBe(400);
  });

  it('closes on Escape and restores scrolling, and prevents audit-only access', async () => {
    const originalOverflow = document.body.style.overflow;
    await open();
    expect(document.body.style.overflow).toBe('hidden');
    component.onDailyActivityKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.isDailyActivityModalOpen).toBeFalse();
    expect(document.body.style.overflow).toBe(originalOverflow);
    (component.auth as any).isAdmin = false;
    (component.auth as any).isDistributor = true;
    component.openDailyActivityModal(0);
    expect(component.isDailyActivityModalOpen).toBeFalse();
    expect(getClients).toHaveBeenCalledTimes(2);
  });
});

describe('TodayCentralComponent daily modal template', () => {
  let fixture: ComponentFixture<TodayCentralComponent>;
  let component: TodayCentralComponent;
  let getClients: jasmine.Spy;
  let getCashPayments: jasmine.Spy;

  beforeEach(async () => {
    getCashPayments = jasmine.createSpy('getEmployeeCashPaymentsForDay').and.resolveTo([
      { id: 'cash-b', ownerUid: 'b', clientUid: 'b', fullName: 'Paul', dayKey: '9-1-2026',
        amount: 200, createdAtMs: 1, source: 'manual' },
      { id: 'cash-a', ownerUid: 'a', clientUid: 'a', fullName: 'Esther', dayKey: '9-1-2026',
        amount: 100, createdAtMs: 2, source: 'mobile_money' },
    ]);
    getClients = jasmine.createSpy('getClientsOfAUserForMonth').and.callFake((uid: string) => of([{
      uid: 'client-a', firstName: uid === 'a' ? 'Esther' : 'Paul',
      payments: { '9-1-2026-8-0-0': '100' }, debtCycleStartDate: '9-1-2026', loanAmount: '1000',
    }]));
    await TestBed.configureTestingModule({
      declarations: [TodayCentralComponent], imports: [FormsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: {
          isAdmin: true, currentUser: {}, getClientsOfAUserForMonth: getClients,
          getManagementInfo: () => of([]),
          getAllUsersInfo: () => of([{ uid: 'b', firstName: 'Zongo' }, { uid: 'a', firstName: 'Bandal' }]),
        } },
        { provide: DataService, useValue: { getEmployeeCashPaymentsForDay: getCashPayments } },
        { provide: ComputationService, useValue: {} },
        { provide: TimeService, useValue: {
          getTomorrowsDateMonthDayYear: () => '9-2-2026', todaysDateMonthDayYear: () => '9-1-2026',
          convertDateToDayMonthYear: () => '01/09/2026', getTodaysDateYearMonthDay: () => '2026-09-01',
        } },
      ], schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(TodayCentralComponent);
    component = fixture.componentInstance;
    spyOn(component, 'initalizeInputs');
    spyOn<any>(component, 'loadCashFlowPaymentRanking');
    spyOn<any>(component, 'loadAuditPaymentPerformance');
    fixture.detectChanges();
  });

  afterEach(() => component.ngOnDestroy());

  it('opens cash flow on click and Space, explains exclusions, and searches without more reads', async () => {
    const card = fixture.nativeElement.querySelector('article[aria-label="Voir Paiement Cash Flow Du Jour par site"]');
    expect(card).not.toBeNull();
    expect(card.querySelector('a')).toBeNull();
    expect(getCashPayments).not.toHaveBeenCalled();
    component.cashFlowPaymentTotalFc = 300;
    card.click();
    await component.loadDailyActivityDetails();
    fixture.detectChanges();
    let dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Paiements cash flow du jour');
    expect(dialog.textContent).toContain("Hors transferts d'épargne et dépôts d'épargne");
    expect(dialog.textContent).toContain('Mobile Money confirmé');
    expect(dialog.textContent).toContain('Paiements listés');
    expect(dialog.textContent).toContain('cache pour cette date');
    expect(dialog.textContent).not.toContain('diffère du total central');
    expect([...dialog.querySelectorAll('h3')].map((h: any) => h.textContent)).toEqual(['Bandal', 'Zongo']);
    const search = dialog.querySelector('input[type="search"]');
    search.value = 'Esther'; search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(dialog.textContent).not.toContain('Paul');
    dialog.querySelector('button[aria-label="Fermer"]').click();
    fixture.detectChanges();
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    card.dispatchEvent(space);
    await component.loadDailyActivityDetails();
    fixture.detectChanges();
    expect(space.defaultPrevented).toBeTrue();
    dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Paul');
    expect(getCashPayments).toHaveBeenCalledTimes(1);
    expect(getClients).not.toHaveBeenCalled();
  });

  it('opens payments on card click, renders grouped records, and filters without reads', async () => {
    const card = fixture.nativeElement.querySelector('article[aria-label="Voir Paiement Du Jour par site"]');
    expect(card).not.toBeNull();
    expect(card.querySelector('a')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(getClients).not.toHaveBeenCalled();
    card.click();
    await component.loadDailyActivityDetails();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Paiements du jour');
    expect([...dialog.querySelectorAll('h3')].map((h: any) => h.textContent)).toEqual(['Bandal', 'Zongo']);
    expect(dialog.textContent).toContain('Esther');
    const search = dialog.querySelector('input[type="search"]');
    search.value = 'Esther';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(dialog.textContent).toContain('Esther');
    expect(dialog.textContent).not.toContain('Paul');
    expect(getClients).toHaveBeenCalledTimes(2);
    dialog.querySelector('button[aria-label="Fermer"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens loans with the keyboard and preserves links on other cards', async () => {
    const card = fixture.nativeElement.querySelector('article[aria-label="Voir Emprunt Du Jour par site"]');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await component.loadDailyActivityDetails();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Emprunts du jour');
    expect(dialog.textContent).toContain('1,000');
    const links = fixture.nativeElement.querySelectorAll('article a');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('/daily-payments');
  });

  it('keeps Tab inside the loading dialog even when filters and refresh are disabled', async () => {
    getClients.and.returnValue(new Subject<any[]>());
    fixture.nativeElement.querySelector('article[aria-label="Voir Paiement Du Jour par site"]').click();
    fixture.detectChanges();
    // ngModel propagates the disabled state to the native controls in a
    // microtask, before the dialog's deferred initial focus runs.
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"] input').disabled).toBeTrue();
    const close = fixture.nativeElement.querySelector('[role="dialog"] button[aria-label="Fermer"]');
    close.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    component.onDailyActivityKeydown(tab);
    expect(tab.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(close);
  });
});
