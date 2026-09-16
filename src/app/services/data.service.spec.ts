import { Client } from '../models/client';
import { CANONICAL_MANAGEMENT_DOCUMENT_ID } from '../models/management';
import { of } from 'rxjs';
import { DataService } from './data.service';

describe('DataService', () => {
  describe('on-demand employee cash payment details', () => {
    const dayKey = '9-1-2026';
    let totals: any[];
    let ledgers: Record<string, any[]>;
    let clients: Record<string, any>;
    let collectionGroup: jasmine.Spy;
    let collection: jasmine.Spy;
    let doc: jasmine.Spy;
    let queries: any[][];
    let readSources: unknown[];
    let service: DataService;
    const snapshot = (docs: any[]) => ({ forEach: (callback: (doc: any) => void) => docs.forEach(callback) });
    const stored = (path: string, data: any) => ({ ref: { path }, data: () => data });
    const employee = (owner: string, id: string, day = dayKey) =>
      stored(`users/${owner}/employees/${id}/dayTotals/${day}`, { dayKey: day, total: 999 });
    const payment = (owner: string, employeeId: string, id: string, data: any) =>
      stored(`users/${owner}/employees/${employeeId}/payments/${id}`, { dayKey, createdAtMs: 123, ...data });

    beforeEach(() => {
      totals = [employee('a', 'e1'), employee('a', 'e1'), employee('b', 'e2'),
        employee('not-selected', 'e3'), employee('a', 'e4', '9-10-2026'),
        stored('other/a/employees/e5/dayTotals/9-1-2026', { dayKey })];
      ledgers = {
        'users/a/employees/e1/payments': [
          payment('a', 'e1', 'mixed', { clientUid: 'c1', amount: 100, savings: 50 }),
          payment('a', 'e1', 'mobile', { clientUid: 'c1', amount: '200', savings: 80, source: 'mobile_money' }),
          payment('a', 'e1', 'savings-only', { clientUid: 'c2', amount: 0, savings: 5000 }),
          payment('a', 'e1', 'deleted-client', { clientUid: 'c3', trackingId: 'A-42', amount: 10 }),
          payment('a', 'e1', 'correction', { clientUid: 'c1', amount: -20 }),
          payment('a', 'e1', 'other-day', { clientUid: 'c1', amount: 8888, dayKey: '9-10-2026' }),
          payment('not-selected', 'e1', 'wrong-path', { clientUid: 'c1', amount: 9999 }),
        ],
        'users/b/employees/e2/payments': [payment('b', 'e2', 'cash', { clientUid: 'c1', amount: 300 })],
      };
      clients = {
        'users/a/clients/c1': { firstName: 'Esther', lastName: 'Mvumbi', payments: { '9-1-2026': '50000' } },
        'users/b/clients/c1': { name: 'Paul' },
      };
      queries = [];
      readSources = [];
      collectionGroup = jasmine.createSpy('collectionGroup').and.returnValue({
        where: (...args: any[]) => {
          queries.push(['dayTotals', ...args]);
          return { get: async (options: unknown) => { readSources.push(options); return snapshot(totals); } };
        },
      });
      collection = jasmine.createSpy('collection').and.callFake((path: string) => ({
        where: (...args: any[]) => {
          queries.push([path, ...args]);
          return { get: async (options: unknown) => { readSources.push(options); return snapshot(ledgers[path] || []); } };
        },
      }));
      doc = jasmine.createSpy('doc').and.callFake((path: string) => ({ get: async (options: unknown) => {
        readSources.push(options); return { data: () => clients[path] };
      } }));
      service = new DataService({ firestore: { collectionGroup, collection, doc } } as any,
        {} as any, {} as any, {
          getTomorrowsDateMonthDayYear: () => '9-2-2026', todaysDate: () => '9-1-2026-12-0-0',
        } as any,
        {} as any, {} as any);
    });

    it('counts repayment amount only, including Mobile Money and signed corrections, never savings', async () => {
      const rows = await service.getEmployeeCashPaymentsForDay(dayKey, ['a', 'b']);
      expect(rows.length).toBe(5);
      expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(590);
      expect(rows.find((row) => row.id.endsWith('/mixed'))?.amount).toBe(100);
      expect(rows.find((row) => row.id.endsWith('/mobile'))?.source).toBe('mobile_money');
      expect(rows.filter((row) => row.ownerUid === 'a' && row.clientUid === 'c1')
        .every((row) => row.fullName === 'Esther Mvumbi')).toBeTrue();
      expect(rows.find((row) => row.ownerUid === 'b')?.fullName).toBe('Paul');
      expect(rows.find((row) => row.clientUid === 'c3')?.fullName).toBe('Client A-42');
    });

    it('queries exact selected-day ledgers once per employee and names once per unique site/client', async () => {
      await service.getEmployeeCashPaymentsForDay(dayKey, ['a', 'b', 'a']);
      expect(collectionGroup).toHaveBeenCalledOnceWith('dayTotals');
      expect(collection.calls.allArgs()).toEqual([
        ['users/a/employees/e1/payments'], ['users/b/employees/e2/payments'],
      ]);
      expect(queries).toEqual([
        ['dayTotals', 'dayKey', '==', dayKey],
        ['users/a/employees/e1/payments', 'dayKey', '==', dayKey],
        ['users/b/employees/e2/payments', 'dayKey', '==', dayKey],
      ]);
      expect(doc.calls.allArgs()).toEqual([
        ['users/a/clients/c1'], ['users/a/clients/c3'], ['users/b/clients/c1'],
      ]);
      expect(readSources).toEqual(Array.from({ length: 6 }, () => ({ source: 'server' })));
    });

    it('keeps real ledger entries after a client is deleted or has no safe identity path', async () => {
      ledgers['users/a/employees/e1/payments'] = [
        payment('a', 'e1', 'deleted', { clientUid: 'deleted', amount: 100 }),
        payment('a', 'e1', 'unsafe', { clientUid: 'bad/path', trackingId: 'A-1', amount: 200 }),
      ];
      const rows = await service.getEmployeeCashPaymentsForDay(dayKey, ['a']);
      expect(rows.map((row) => row.fullName)).toEqual(['Client deleted', 'Client A-1']);
      expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(300);
      expect(doc).toHaveBeenCalledOnceWith('users/a/clients/deleted');
    });

    it('fails rather than displaying partial finances when an employee or identity read fails', async () => {
      collection.and.callFake((path: string) => ({ where: () => ({ get: async () => {
        if (path.includes('/b/')) throw new Error('offline');
        return snapshot(ledgers[path]);
      } }) }));
      await expectAsync(service.getEmployeeCashPaymentsForDay(dayKey, ['a', 'b'])).toBeRejected();
      expect(doc).not.toHaveBeenCalled();
      collection.and.callFake((path: string) => ({ where: () => ({ get: async () => snapshot(ledgers[path] || []) }) }));
      doc.and.returnValue({ get: async () => { throw new Error('offline'); } });
      await expectAsync(service.getEmployeeCashPaymentsForDay(dayKey, ['a'])).toBeRejected();
    });

    it('rejects malformed financial values instead of silently changing a payment', async () => {
      for (const amount of [NaN, Infinity, 'invalid', '', ' ', true, undefined]) {
        ledgers['users/a/employees/e1/payments'] = [payment('a', 'e1', 'bad', { amount })];
        await expectAsync(service.getEmployeeCashPaymentsForDay(dayKey, ['a'])).toBeRejected();
      }
      expect(doc).not.toHaveBeenCalled();
    });

    it('does no reads without selected sites or a valid calendar date', async () => {
      expect(await service.getEmployeeCashPaymentsForDay(dayKey, [])).toEqual([]);
      for (const day of ['invalid', '2-30-2026', '13-1-2026', '9-0-2026']) {
        expect(await service.getEmployeeCashPaymentsForDay(day, ['a'])).toEqual([]);
      }
      expect(collectionGroup).not.toHaveBeenCalled();
    });

    it('caps simultaneous ledger reads at eight on large days', async () => {
      totals = Array.from({ length: 30 }, (_, index) => employee('a', `e${index}`));
      let active = 0;
      let max = 0;
      collection.and.returnValue({ where: () => ({ get: async () => {
        active++; max = Math.max(max, active);
        await Promise.resolve(); active--;
        return snapshot([]);
      } }) });
      expect(await service.getEmployeeCashPaymentsForDay(dayKey, ['a'])).toEqual([]);
      expect(collection).toHaveBeenCalledTimes(30);
      expect(max).toBe(8);
    });

    it('does not start queued ledger reads after a stalled query exceeds the UI timeout', async () => {
      spyOn(Date, 'now').and.returnValues(0, 30001);
      await expectAsync(service.getEmployeeCashPaymentsForDay(dayKey, ['a', 'b'])).toBeRejected();
      expect(collection).not.toHaveBeenCalled();
      expect(doc).not.toHaveBeenCalled();
    });
  });

  it('accumulates savings-to-payment totals independently from daily payments', () => {
    const service = new DataService(
      {} as any,
      {} as any,
      {
        currentUser: {
          dailySavingsToPayment: { '8-23-2026': '20000' },
        },
      } as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-24-2026',
        todaysDate: () => '8-23-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );

    expect(service.computeDailySavingsToPayment('8-23-2026', '15000')).toBe(
      35000
    );
    expect(service.computeDailySavingsToPayment('8-24-2026', '10000')).toBe(
      '10000'
    );
  });

  it('marks a direct-only day in the existing payment write', async () => {
    const userRef = {
      set: jasmine.createSpy('set').and.resolveTo(undefined),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue(userRef),
    };
    const service = new DataService(
      afs as any,
      {} as any,
      {
        currentUser: {
          uid: 'owner-1',
          clientsSavings: '0',
          moneyInHands: '0',
          totalDebtLeft: '100000',
          dailyReimbursement: {},
          dailySaving: {},
        },
      } as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-24-2026',
        todaysDate: () => '8-23-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );

    await service.updateUserInfoForClientPayment(
      new Client(),
      '0',
      '8-23-2026',
      '15000'
    );

    expect(userRef.set).toHaveBeenCalledTimes(1);
    expect(userRef.set.calls.mostRecent().args[0].dailySavingsToPayment).toEqual(
      { '8-23-2026': '0' }
    );
  });

  it('groups one day of employee cash payments by team with one query', async () => {
    const docs = [
      {
        ref: {
          path: 'users/site-a/employees/employee-1/dayTotals/8-22-2026',
        },
        data: () => ({ total: 600, count: 1, dayKey: '8-22-2026' }),
      },
      {
        ref: {
          path: 'users/site-a/employees/employee-2/dayTotals/8-22-2026',
        },
        data: () => ({ collected: '400', count: 2, dayKey: '8-22-2026' }),
      },
      {
        ref: {
          path: 'users/site-b/employees/employee-3/dayTotals/8-22-2026',
        },
        data: () => ({ paid: 300, count: 1, dayKey: '8-22-2026' }),
      },
      {
        ref: {
          path: 'users/not-selected/employees/employee-4/dayTotals/8-22-2026',
        },
        data: () => ({ total: 9999, count: 1, dayKey: '8-22-2026' }),
      },
    ];
    const get = jasmine.createSpy('get').and.resolveTo({
      forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    });
    const where = jasmine.createSpy('where').and.returnValue({ get });
    const collectionGroup = jasmine
      .createSpy('collectionGroup')
      .and.returnValue({ where });
    const service = new DataService(
      { firestore: { collectionGroup } } as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-23-2026',
        todaysDate: () => '8-22-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );

    const result = await service.getEmployeeDayTotalsGroupedByTeam(
      '8-22-2026',
      ['site-a', 'site-b']
    );

    expect(collectionGroup).toHaveBeenCalledTimes(1);
    expect(collectionGroup).toHaveBeenCalledWith('dayTotals');
    expect(where).toHaveBeenCalledOnceWith('dayKey', '==', '8-22-2026');
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { ownerUid: 'site-a', total: 1000, count: 3 },
      { ownerUid: 'site-b', total: 300, count: 1 },
    ]);
  });

  it('groups several employee cash-payment days by team with one query', async () => {
    const docs = [
      {
        ref: {
          path: 'users/site-a/employees/employee-1/dayTotals/8-19-2026',
        },
        data: () => ({ total: 200, count: 1, dayKey: '8-19-2026' }),
      },
      {
        ref: {
          path: 'users/site-a/employees/employee-2/dayTotals/8-22-2026',
        },
        data: () => ({ collected: '600', count: 2, dayKey: '8-22-2026' }),
      },
      {
        ref: {
          path: 'users/site-a/employees/employee-3/dayTotals/8-22-2026',
        },
        data: () => ({ paid: 400, count: 1, dayKey: '8-22-2026' }),
      },
      {
        ref: {
          path: 'users/site-b/employees/employee-4/dayTotals/8-22-2026',
        },
        data: () => ({ total: 300, count: 1, dayKey: '8-22-2026' }),
      },
      {
        ref: {
          path: 'users/not-selected/employees/employee-5/dayTotals/8-22-2026',
        },
        data: () => ({ total: 9999, count: 1, dayKey: '8-22-2026' }),
      },
    ];
    const get = jasmine.createSpy('get').and.resolveTo({
      forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    });
    const where = jasmine.createSpy('where').and.returnValue({ get });
    const collectionGroup = jasmine
      .createSpy('collectionGroup')
      .and.returnValue({ where });
    const service = new DataService(
      { firestore: { collectionGroup } } as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-23-2026',
        todaysDate: () => '8-22-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );

    const result = await service.getEmployeeDayTotalsGroupedByTeamForDays(
      ['8-19-2026', '8-22-2026'],
      ['site-a', 'site-b']
    );

    expect(collectionGroup).toHaveBeenCalledOnceWith('dayTotals');
    expect(where).toHaveBeenCalledOnceWith('dayKey', 'in', [
      '8-19-2026',
      '8-22-2026',
    ]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { dayKey: '8-19-2026', ownerUid: 'site-a', total: 200, count: 1 },
      { dayKey: '8-22-2026', ownerUid: 'site-a', total: 1000, count: 3 },
      { dayKey: '8-22-2026', ownerUid: 'site-b', total: 300, count: 1 },
    ]);
  });

  it('groups one month of employee cash payments by team with one query', async () => {
    const docs = [
      {
        ref: { path: 'users/site-a/employees/employee-1/dayTotals/8-1-2026' },
        data: () => ({ total: 600, count: 1, monthKey: '2026-08' }),
      },
      {
        ref: { path: 'users/site-a/employees/employee-2/dayTotals/8-2-2026' },
        data: () => ({ collected: '400', count: 2, monthKey: '2026-08' }),
      },
      {
        ref: { path: 'users/site-b/employees/employee-3/dayTotals/8-3-2026' },
        data: () => ({ paid: 300, count: 1, monthKey: '2026-08' }),
      },
      {
        ref: { path: 'users/not-selected/dayTotals/8-4-2026' },
        data: () => ({ total: 9999, count: 1, monthKey: '2026-08' }),
      },
    ];
    const get = jasmine.createSpy('get').and.resolveTo({
      forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    });
    const where = jasmine.createSpy('where').and.returnValue({ get });
    const collectionGroup = jasmine
      .createSpy('collectionGroup')
      .and.returnValue({ where });
    const service = new DataService(
      { firestore: { collectionGroup } } as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-23-2026',
        todaysDate: () => '8-22-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );

    const result = await service.getEmployeeMonthTotalsGroupedByTeam(
      '2026-08',
      ['site-a', 'site-b']
    );

    expect(collectionGroup).toHaveBeenCalledTimes(1);
    expect(collectionGroup).toHaveBeenCalledWith('dayTotals');
    expect(where).toHaveBeenCalledOnceWith('monthKey', '==', '2026-08');
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { ownerUid: 'site-a', total: 1000, count: 3 },
      { ownerUid: 'site-b', total: 300, count: 1 },
    ]);
  });

  it('groups several employee cash-payment months with one query', async () => {
    const docs = [
      {
        ref: { path: 'users/site-a/employees/employee-1/dayTotals/7-31-2026' },
        data: () => ({ total: 400, count: 1, monthKey: '2026-07' }),
      },
      {
        ref: { path: 'users/site-a/employees/employee-1/dayTotals/8-1-2026' },
        data: () => ({ total: 600, count: 1, monthKey: '2026-08' }),
      },
      {
        ref: { path: 'users/site-a/employees/employee-2/dayTotals/8-2-2026' },
        data: () => ({ collected: '400', count: 2, monthKey: '2026-08' }),
      },
      {
        ref: { path: 'users/site-b/employees/employee-3/dayTotals/8-3-2026' },
        data: () => ({ paid: 300, count: 1, monthKey: '2026-08' }),
      },
      {
        ref: {
          path: 'users/not-selected/employees/employee-4/dayTotals/8-3-2026',
        },
        data: () => ({ total: 9999, count: 1, monthKey: '2026-08' }),
      },
    ];
    const get = jasmine.createSpy('get').and.resolveTo({
      forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    });
    const where = jasmine.createSpy('where').and.returnValue({ get });
    const collectionGroup = jasmine
      .createSpy('collectionGroup')
      .and.returnValue({ where });
    const service = new DataService(
      { firestore: { collectionGroup } } as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-23-2026',
        todaysDate: () => '8-22-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );

    const result = await service.getEmployeeMonthTotalsGroupedByTeamForMonths(
      ['2026-07', '2026-08', '2026-08'],
      ['site-a', 'site-b']
    );

    expect(collectionGroup).toHaveBeenCalledOnceWith('dayTotals');
    expect(where).toHaveBeenCalledOnceWith('monthKey', 'in', [
      '2026-07',
      '2026-08',
    ]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        monthKey: '2026-07',
        ownerUid: 'site-a',
        total: 400,
        count: 1,
      },
      {
        monthKey: '2026-08',
        ownerUid: 'site-a',
        total: 1000,
        count: 3,
      },
      {
        monthKey: '2026-08',
        ownerUid: 'site-b',
        total: 300,
        count: 1,
      },
    ]);
  });

  it('groups one week of employee cash payments with one range query', async () => {
    const docs = [
      {
        ref: { path: 'users/site-a/employees/employee-1/dayTotals/8-17-2026' },
        data: () => ({ total: 600, count: 1 }),
      },
      {
        ref: { path: 'users/site-a/employees/employee-2/dayTotals/8-21-2026' },
        data: () => ({ collected: '400', count: 2 }),
      },
      {
        ref: { path: 'users/site-b/employees/employee-3/dayTotals/8-23-2026' },
        data: () => ({ paid: 300, count: 1 }),
      },
    ];
    const get = jasmine.createSpy('get').and.resolveTo({
      forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    });
    const endWhere = jasmine.createSpy('endWhere').and.returnValue({ get });
    const startWhere = jasmine
      .createSpy('startWhere')
      .and.returnValue({ where: endWhere });
    const collectionGroup = jasmine
      .createSpy('collectionGroup')
      .and.returnValue({ where: startWhere });
    const service = new DataService(
      { firestore: { collectionGroup } } as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-24-2026',
        todaysDate: () => '8-23-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );
    const startMs = new Date(2026, 7, 17).getTime();
    const endMs = new Date(2026, 7, 23).getTime();

    const result = await service.getEmployeeWeekTotalsGroupedByTeam(
      startMs,
      endMs,
      ['site-a', 'site-b']
    );

    expect(collectionGroup).toHaveBeenCalledOnceWith('dayTotals');
    expect(startWhere).toHaveBeenCalledOnceWith(
      'dayStartMs',
      '>=',
      startMs
    );
    expect(endWhere).toHaveBeenCalledOnceWith('dayStartMs', '<=', endMs);
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { ownerUid: 'site-a', total: 1000, count: 3 },
      { ownerUid: 'site-b', total: 300, count: 1 },
    ]);
  });

  it('loads a cash-payment history range once and groups it by day', async () => {
    const docs = [
      {
        ref: { path: 'users/site-a/employees/employee-1/dayTotals/8-17-2026' },
        data: () => ({ dayKey: '8-17-2026', total: 600, count: 1 }),
      },
      {
        ref: { path: 'users/site-b/employees/employee-2/dayTotals/8-17-2026' },
        data: () => ({ dayKey: '8-17-2026', collected: '400', count: 2 }),
      },
      {
        ref: { path: 'users/site-a/employees/employee-1/dayTotals/8-18-2026' },
        data: () => ({ dayKey: '8-18-2026', paid: 300, count: 1 }),
      },
      {
        ref: {
          path: 'users/not-selected/employees/employee-3/dayTotals/8-18-2026',
        },
        data: () => ({ dayKey: '8-18-2026', total: 9999, count: 1 }),
      },
    ];
    const get = jasmine.createSpy('get').and.resolveTo({
      forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    });
    const endWhere = jasmine.createSpy('endWhere').and.returnValue({ get });
    const startWhere = jasmine
      .createSpy('startWhere')
      .and.returnValue({ where: endWhere });
    const collectionGroup = jasmine
      .createSpy('collectionGroup')
      .and.returnValue({ where: startWhere });
    const service = new DataService(
      { firestore: { collectionGroup } } as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-24-2026',
        todaysDate: () => '8-23-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );
    const startMs = new Date(2026, 7, 17).getTime();
    const endMs = new Date(2026, 7, 23).getTime();

    const result = await service.getEmployeeCashPaymentDayTotals(
      startMs,
      endMs,
      ['site-a', 'site-b']
    );

    expect(collectionGroup).toHaveBeenCalledOnceWith('dayTotals');
    expect(startWhere).toHaveBeenCalledOnceWith('dayStartMs', '>=', startMs);
    expect(endWhere).toHaveBeenCalledOnceWith('dayStartMs', '<=', endMs);
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { dayKey: '8-17-2026', total: 1000, count: 3 },
      { dayKey: '8-18-2026', total: 300, count: 1 },
    ]);
  });

  it('never writes NaN when cancelling a normal pending loan request', async () => {
    const userRef = {
      set: jasmine.createSpy('set').and.resolveTo(undefined),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue(userRef),
    };
    const auth = {
      currentUser: {
        uid: 'owner-1',
        monthBudgetPending: 'NaN',
        moneyInHands: '200000',
        clientsSavings: '50000',
        fees: '15000',
        dailySavingReturns: {},
        dailyFeesReturns: {},
      },
    };
    const service = new DataService(
      afs as any,
      {} as any,
      auth as any,
      {
        todaysDateMonthDayYear: () => '8-16-2026',
        todaysDate: () => '8-16-2026-10-00-00',
        getTomorrowsDateMonthDayYear: () => '8-17-2026',
      } as any,
      {
        computeDailySavingReturn: () => '0',
        computeDailyFeesReturn: () => '0',
      } as any,
      {} as any
    );
    const pendingClient = Object.assign(new Client(), {
      requestStatus: 'pending',
      requestType: 'lending',
      requestAmount: '100000',
      creditScore: '50',
      applicationFee: '5000',
      membershipFee: '10000',
      savings: '30000',
    });

    await service.UpdateUserInfoForCancelingdRegisteredClient(pendingClient);

    const writtenData = userRef.set.calls.mostRecent().args[0];
    expect(writtenData.monthBudgetPending).toBe('0');
    expect(writtenData.monthBudgetPending).not.toBe('NaN');
  });

  it('keeps a score-70 request from changing the legacy pending counter', async () => {
    const userRef = {
      set: jasmine.createSpy('set').and.resolveTo(undefined),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue(userRef),
    };
    const auth = {
      currentUser: {
        uid: 'owner-1',
        monthBudgetPending: '250000',
        numberOfClients: '10',
        clientsSavings: '0',
        fees: '0',
        moneyInHands: '0',
        dailySaving: {},
        dailyMoneyRequests: {},
        feesData: {},
      },
    };
    const service = new DataService(
      afs as any,
      {} as any,
      auth as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-17-2026',
        todaysDate: () => '8-16-2026-10-00-00',
      } as any,
      {
        computeDailyFees: () => '0',
        computeDailySaving: () => '0',
        computeDailyMoneyRequests: () => '0',
      } as any,
      {} as any
    );
    const bestClient = Object.assign(new Client(), {
      requestAmount: '500000',
      requestDate: '8-20-2026',
      creditScore: '70',
      savings: '0',
      applicationFee: '0',
      membershipFee: '0',
    });

    await service.updateUserInfoForRegisterClient(bestClient, '8-16-2026');

    expect(
      userRef.set.calls.mostRecent().args[0].monthBudgetPending
    ).toBe('250000');
  });

  it('appends a gallery picture to the selected site owner without replacing the gallery', async () => {
    const clientRef = {
      update: jasmine.createSpy('update').and.resolveTo(undefined),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue(clientRef),
    };
    const service = new DataService(
      afs as any,
      {} as any,
      { currentUser: { uid: 'investigator-account' } } as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-16-2026',
        todaysDate: () => '8-15-2026',
      } as any,
      {} as any,
      {} as any
    );
    const picture = {
      id: 'payment-responsibility-1',
      category: 'other',
      mediaType: 'image',
      url: 'https://example.com/document.jpg',
      path: 'client-gallery/client/site-2/client-9/payment-responsibility/document.jpg',
      size: 2048,
      uploadedAt: '2026-08-15T16:07:06.045Z',
      documentType: 'payment_responsibility',
      paymentResponsibleName: 'Marie Kavanda',
      paymentResponsibilityEffectiveAt: '2026-08-15T16:07:06.045Z',
    } as const;

    await service.addClientGalleryPictureForUser('site-2', 'client-9', picture);

    expect(afs.doc).toHaveBeenCalledWith('users/site-2/clients/client-9');
    expect(clientRef.update).toHaveBeenCalledWith({
      'galleryPictures.payment-responsibility-1': picture,
    });
  });

  it('persists phone history with a register request update', async () => {
    const clientRef = {
      set: jasmine.createSpy('set').and.resolveTo(undefined),
      update: jasmine.createSpy('update').and.resolveTo(undefined),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue(clientRef),
    };
    const service = new DataService(
      afs as any,
      {} as any,
      { currentUser: { uid: 'owner-1' } } as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-13-2026',
        todaysDate: () => '8-12-2026',
      } as any,
      {} as any,
      {} as any
    );

    await service.registerClientRequestUpdate({
      uid: 'client-1',
      phoneNumber: '0999999999',
      previousPhoneNumbers: ['0811111111'],
    });

    expect(afs.doc).toHaveBeenCalledWith(
      'users/owner-1/clients/client-1'
    );
    expect(clientRef.set).toHaveBeenCalledWith(
      jasmine.objectContaining({
        phoneNumber: '0999999999',
        previousPhoneNumbers: ['0811111111'],
      }),
      { merge: true }
    );
  });

  it('removes from the latest queue without losing a concurrent assignment', async () => {
    const auditRef = {};
    const transaction = {
      get: jasmine.createSpy('get').and.resolveTo({
        exists: true,
        data: () => ({
          pendingClients: [
            { clientId: 'joseph' },
            { clientId: 'marie' },
            { clientId: 'richard' },
          ],
        }),
      }),
      update: jasmine.createSpy('update'),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue({ ref: auditRef }),
      firestore: {
        runTransaction: (callback: (tx: any) => Promise<void>) =>
          callback(transaction),
      },
    };
    const service = new DataService(
      afs as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-8-2026',
        todaysDate: () => '8-7-2026',
      } as any,
      {} as any,
      {} as any
    );

    await service.removePendingClientFromAudit('helene', 'joseph');

    expect(transaction.get).toHaveBeenCalledWith(auditRef);
    expect(transaction.update).toHaveBeenCalledWith(auditRef, {
      pendingClients: [{ clientId: 'marie' }, { clientId: 'richard' }],
    });
  });

  it('finalizes attendance and its photo in one atomic batch', async () => {
    const refs = new Map<string, { path: string }>();
    const doc = (path: string) => {
      if (!refs.has(path)) refs.set(path, { path });
      return refs.get(path)!;
    };
    const batch = {
      set: jasmine.createSpy('set'),
      commit: jasmine.createSpy('commit').and.resolveTo(undefined),
    };
    const afs = {
      firestore: {
        doc: jasmine.createSpy('doc').and.callFake(doc),
        batch: jasmine.createSpy('batch').and.returnValue(batch),
      },
    };
    const service = new DataService(
      afs as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-8-2026',
        todaysDate: () => '8-7-2026',
      } as any,
      {} as any,
      {} as any
    );
    const attachment = {
      url: 'https://firebase.test/presence',
      path: 'attendance_proofs/site/employee/2026-08-07/123.jpeg',
      size: 12345,
      contentType: 'image/jpeg',
      uploadedAt: 1786099353292,
      uploaderId: 'site',
      takenAt: 1786099350000,
    };

    await service.finalizeAttendanceWithAttachment(
      'site',
      'employee',
      '2026-08-07',
      'L',
      '8-7-2026-12-9-19',
      'site',
      attachment
    );

    expect(afs.firestore.batch).toHaveBeenCalledTimes(1);
    expect(batch.set).toHaveBeenCalledTimes(3);
    expect(batch.set).toHaveBeenCalledWith(
      doc('users/site/employees/employee'),
      {
        attendance: { '8-7-2026-12-9-19': 'L' },
        attendanceAttachments: {
          '8-7-2026-12-9-19': attachment,
        },
      },
      { merge: true }
    );
    expect(batch.set).toHaveBeenCalledWith(
      doc('users/site/employees/employee/attendance/2026-08-07'),
      jasmine.objectContaining({
        status: 'L',
        proofState: 'ready',
        proof: attachment,
        attachmentId: '123_jpeg',
      }),
      { merge: true }
    );
    expect(batch.set).toHaveBeenCalledWith(
      doc(
        'users/site/employees/employee/attendance/2026-08-07/attachments/123_jpeg'
      ),
      attachment,
      { merge: true }
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('retries an atomic attendance commit without creating partial writes', async () => {
    const firstBatch = {
      set: jasmine.createSpy('firstSet'),
      commit: jasmine
        .createSpy('firstCommit')
        .and.rejectWith({ code: 'firestore/unavailable' }),
    };
    const secondBatch = {
      set: jasmine.createSpy('secondSet'),
      commit: jasmine.createSpy('secondCommit').and.resolveTo(undefined),
    };
    const afs = {
      firestore: {
        doc: (path: string) => ({ path }),
        batch: jasmine
          .createSpy('batch')
          .and.returnValues(firstBatch, secondBatch),
      },
    };
    const service = new DataService(
      afs as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-8-2026',
        todaysDate: () => '8-7-2026',
      } as any,
      {} as any,
      {} as any
    );

    await service.finalizeAttendanceWithAttachment(
      'site',
      'employee',
      '2026-08-07',
      'P',
      '8-7-2026-8-0-0',
      'site',
      {
        url: 'https://firebase.test/presence',
        path: 'attendance_proofs/site/employee/2026-08-07/456.jpg',
        size: 100,
        contentType: 'image/jpeg',
        uploadedAt: 1786099353292,
        uploaderId: 'site',
      },
      [0]
    );

    expect(afs.firestore.batch).toHaveBeenCalledTimes(2);
    expect(firstBatch.commit).toHaveBeenCalledTimes(1);
    expect(secondBatch.commit).toHaveBeenCalledTimes(1);
    expect(firstBatch.set).toHaveBeenCalledTimes(3);
    expect(secondBatch.set).toHaveBeenCalledTimes(3);
  });

  describe('reserve transaction integrity', () => {
    function setupReserveTransaction(options?: {
      cachedManagement?: Record<string, any>;
      managementDocuments?: Array<Record<string, any>>;
      managementExists?: boolean;
    }) {
      const userRef = { path: 'users/site-1' };
      const managementRef = {
        path: `management/${CANONICAL_MANAGEMENT_DOCUMENT_ID}`,
      };
      const managementSet = jasmine
        .createSpy('managementSet')
        .and.returnValue(Promise.resolve());
      const tx = {
        get: jasmine.createSpy('transactionGet').and.callFake((ref: any) => {
          if (ref.path === userRef.path) {
            return Promise.resolve({
              exists: true,
              data: () => ({
                reserveAmount: '1000',
                reserveAmountDollar: '1',
                moneyInHands: '500000',
                reserve: {},
                reserveinDollar: {},
              }),
            });
          }

          return Promise.resolve({
            exists: options?.managementExists !== false,
            data: () => ({
              id: CANONICAL_MANAGEMENT_DOCUMENT_ID,
              moneyInHands: '100000',
              reserve: {},
            }),
          });
        }),
        set: jasmine.createSpy('transactionSet'),
      };
      const runTransaction = jasmine
        .createSpy('runTransaction')
        .and.callFake((callback: (transaction: any) => Promise<void>) =>
          callback(tx)
        );
      const afs = {
        firestore: { runTransaction },
        doc: jasmine.createSpy('doc').and.callFake((path: string) => {
          if (path === userRef.path) return { ref: userRef };
          if (path === managementRef.path) {
            return { ref: managementRef, set: managementSet };
          }
          throw new Error(`Unexpected Firestore path: ${path}`);
        }),
      };
      const canonicalManagement = {
        id: CANONICAL_MANAGEMENT_DOCUMENT_ID,
        moneyInHands: '100000',
        reserve: {},
      };
      const auth = {
        currentUser: {
          uid: 'site-1',
          firstName: 'Pumbu',
          mode: 'production',
        },
        managementInfo: options?.cachedManagement ?? {},
        getManagementInfo: jasmine
          .createSpy('getManagementInfo')
          .and.returnValue(
            of(options?.managementDocuments ?? [canonicalManagement])
          ),
      };
      const service = new DataService(
        afs as any,
        {} as any,
        auth as any,
        {
          getTomorrowsDateMonthDayYear: () => '8-27-2026',
          todaysDate: () => '8-26-2026-16-15-45',
          reserveTargetDateKey: () => '8-27-2026',
        } as any,
        {
          convertCongoleseFrancToUsDollars: () => 46,
        } as any,
        {} as any
      );

      return {
        afs,
        auth,
        managementRef,
        managementSet,
        runTransaction,
        service,
        tx,
        userRef,
      };
    }

    it('waits for the canonical management document and writes both sides atomically', async () => {
      const { afs, auth, managementRef, service, tx, userRef } =
        setupReserveTransaction({ cachedManagement: {} });

      await service.atomicAddToReserve('135000', true);

      expect(auth.getManagementInfo).toHaveBeenCalledTimes(1);
      expect(auth.managementInfo['id']).toBe(
        CANONICAL_MANAGEMENT_DOCUMENT_ID
      );
      expect(afs.doc).toHaveBeenCalledWith(userRef.path);
      expect(afs.doc).toHaveBeenCalledWith(managementRef.path);
      expect(afs.doc).not.toHaveBeenCalledWith('management/undefined');
      expect(tx.set).toHaveBeenCalledTimes(2);
      expect(tx.set).toHaveBeenCalledWith(
        userRef,
        jasmine.objectContaining({
          moneyInHands: '365000',
          reserve: { '8-26-2026-16-15-45': '135000' },
        }),
        { merge: true }
      );
      expect(tx.set).toHaveBeenCalledWith(
        managementRef,
        jasmine.objectContaining({
          moneyInHands: '235000',
          reserve: { '8-26-2026-16-15-45': '135000' },
        }),
        { merge: true }
      );
    });

    it('fails before starting a transaction when canonical management data is unavailable', async () => {
      const { afs, runTransaction, service, tx } = setupReserveTransaction({
        cachedManagement: {},
        managementDocuments: [],
      });

      await expectAsync(service.atomicAddToReserve('135000', true)).toBeRejectedWithError(
        /canonical management document is unavailable/i
      );

      expect(runTransaction).not.toHaveBeenCalled();
      expect(afs.doc).not.toHaveBeenCalled();
      expect(tx.set).not.toHaveBeenCalled();
    });

    it('aborts without queuing either write when the canonical document does not exist', async () => {
      const { service, tx } = setupReserveTransaction({
        cachedManagement: {
          id: CANONICAL_MANAGEMENT_DOCUMENT_ID,
          moneyInHands: '100000',
        },
        managementExists: false,
      });

      await expectAsync(service.atomicAddToReserve('135000', true)).toBeRejectedWithError(
        /canonical management document does not exist/i
      );

      expect(tx.get).toHaveBeenCalledTimes(2);
      expect(tx.set).not.toHaveBeenCalled();
    });

    it('keeps testing-mode writes isolated from the management ledger', async () => {
      const { auth, service, tx, userRef } = setupReserveTransaction({
        cachedManagement: {},
        managementDocuments: [],
      });

      await service.atomicAddToReserve('135000', false);

      expect(auth.getManagementInfo).not.toHaveBeenCalled();
      expect(tx.get).toHaveBeenCalledOnceWith(userRef);
      expect(tx.set).toHaveBeenCalledTimes(1);
      expect(tx.set).toHaveBeenCalledWith(
        userRef,
        jasmine.objectContaining({
          reserve: { '8-26-2026-16-15-45': '135000' },
        }),
        { merge: true }
      );
    });

    it('waits for canonical data before writing Argent à servir', async () => {
      const { afs, auth, managementRef, managementSet, service } =
        setupReserveTransaction({
          cachedManagement: { id: 'undefined' },
          managementDocuments: [
            {
              id: CANONICAL_MANAGEMENT_DOCUMENT_ID,
              moneyInHands: '100000',
              moneyGiven: {},
            },
          ],
        });

      await service.updateManagementInfoForMoneyGiven('35000');

      expect(auth.getManagementInfo).toHaveBeenCalledTimes(1);
      expect(auth.managementInfo['id']).toBe(
        CANONICAL_MANAGEMENT_DOCUMENT_ID
      );
      expect(afs.doc).toHaveBeenCalledOnceWith(managementRef.path);
      expect(afs.doc).not.toHaveBeenCalledWith('management/undefined');
      expect(managementSet).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          moneyInHands: '65000',
          moneyGiven: { '8-27-2026': '35000' },
          moneyInHandsTracking: { '8-27-2026': '65000' },
        }),
        { merge: true }
      );
    });
  });
});

describe('DataService attendance photo verification callables', () => {
  function createService(): DataService {
    return new DataService(
      {} as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '3-29-2026',
        todaysDate: () => '3-28-2026-9-0-0',
      } as any,
      {} as any,
      {} as any
    );
  }

  it('requests site-side photo verification before attendance is committed', async () => {
    const callable = jasmine.createSpy('callable').and.returnValue(
      of({
        verificationId: 'verification-1',
        verdict: 'clear',
        reason: 'unique',
        algorithmVersion: 'test-v1',
      })
    );
    const functions = {
      httpsCallable: jasmine.createSpy('httpsCallable').and.returnValue(callable),
    } as any;

    const result = await createService().verifyAttendancePhoto(
      functions,
      'employee-1',
      '2026-03-28',
      'attendance_proofs/site-1/employee-1/2026-03-28/photo.jpg'
    );

    expect(functions.httpsCallable).toHaveBeenCalledOnceWith(
      'verifyAttendancePhoto'
    );
    expect(callable).toHaveBeenCalledOnceWith({
      employeeId: 'employee-1',
      dateISO: '2026-03-28',
      storagePath:
        'attendance_proofs/site-1/employee-1/2026-03-28/photo.jpg',
    });
    expect(result.verdict).toBe('clear');
  });

  it('uses the authoritative status returned by verified finalization', async () => {
    const attachment = {
      url: 'https://firebase.test/photo',
      path: 'attendance_proofs/site-1/employee-1/2026-03-28/photo.jpg',
      size: 20,
      contentType: 'image/jpeg',
      uploadedAt: 1774688400000,
      uploaderId: 'site-1',
    };
    const callable = jasmine.createSpy('callable').and.returnValue(
      of({
        status: 'F',
        verdict: 'duplicate',
        reason: 'exact_hash',
        attachment,
      })
    );
    const functions = {
      httpsCallable: jasmine.createSpy('httpsCallable').and.returnValue(callable),
    } as any;
    const input = {
      employeeId: 'employee-1',
      dateISO: '2026-03-28',
      dateLabel: '3-28-2026-9-0-0',
      requestedStatus: 'P' as const,
      verificationId: 'verification-1',
    };

    const result = await createService().finalizeVerifiedAttendance(
      functions,
      input
    );

    expect(functions.httpsCallable).toHaveBeenCalledOnceWith(
      'finalizeVerifiedAttendance'
    );
    expect(callable).toHaveBeenCalledOnceWith(input);
    expect(result.status).toBe('F');
  });
});
