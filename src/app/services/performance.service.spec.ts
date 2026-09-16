import { BehaviorSubject } from 'rxjs';
import { Client } from '../models/client';
import { Employee } from '../models/employee';
import { PerformanceService } from './performance.service';

describe('PerformanceService independent expectations', () => {
  function create() {
    const clients = new BehaviorSubject<Client[]>([]);
    const employees = new BehaviorSubject<Employee[]>([]);
    const writes: Array<{path: string; data: any}> = [];
    const auth = {currentUser: {uid: 'site', pointExpectationSince: '9-16-2026'},
      getAllClients: () => clients, getAllEmployees: () => employees} as any;
    const time = {todaysDateMonthDayYear: () => '9-16-2026', getDayOfWeek: () => 'Wednesday'} as any;
    const afs = {doc: (path: string) => ({set: (data: any) => {
      writes.push({path, data}); return Promise.resolve();
    }})} as any;
    return {service: new PerformanceService(auth, time, afs), auth, clients, employees, writes};
  }

  beforeEach(() => {jasmine.clock().install(); jasmine.clock().mockDate(new Date('2026-09-16T10:00:00Z'));});
  afterEach(() => jasmine.clock().uninstall());

  it('submitting a payment updates achieved only, never captured or legacy expected points', async () => {
    const {service, employees, writes} = create();
    employees.next([{uid: 'agent', clients: ['client'], dailyPoints: {}, expectedPoints: {'9-16-2026': 10}, expectedPointsSince: '9-16-2026'},
      {uid: 'other', clients: [], dailyPoints: {}, expectedPointsSince: '9-16-2026'}]);
    await service.updateUserPerformance({uid: 'client', amountToPay: '1000', paymentPeriodRange: '10', debtCycleStartDate: '9-1-2026'}, '100');
    const employeeWrites = writes.filter((write) => write.path.includes('/employees/'));
    expect(employeeWrites.length).toBe(1);
    expect(employeeWrites[0].data).toEqual({dailyPoints: {'9-16-2026': '1'}});
  });

  it('does not accumulate subscriptions or write invalid points on repeated submission', async () => {
    const {service, clients, employees, writes} = create();
    employees.next([{uid: 'agent', clients: [], dailyPoints: {}, expectedPointsSince: '9-16-2026'}]);
    await service.updateUserPerformance({} as Client);
    await service.updateUserPerformance({} as Client);
    expect(clients.observers.length).toBe(1);
    expect(writes.every((write) => !write.path.includes('/employees/'))).toBeTrue();
  });

  it('payment on an inactive-assigned client still earns points for the manager without rewriting expectations', async () => {
    const { service, employees, writes } = create();
    const inactive: Employee = {uid: 'inactive', status: 'Quitté', dateLeft: '9-1-2026', clients: ['client'],
      dailyPoints: {}, expectedPoints: {'9-16-2026': 1}, expectedPointsSince: '9-16-2026'};
    const manager: Employee = {uid: 'manager', role: 'Manager', status: 'Travaille', clients: [],
      dailyPoints: {}, expectedPoints: {'9-16-2026': 0}, expectedPointsSince: '9-16-2026'};
    employees.next([inactive, manager]);
    expect(service.findAverageAndTotalAllEmployee([inactive, manager])).toEqual([0, 1]);
    await service.updateUserPerformance({uid: 'client', agent: 'inactive', amountToPay: '1000',
      paymentPeriodRange: '10', debtCycleStartDate: '9-1-2026'}, '100');
    expect(service.findAverageAndTotalAllEmployee([inactive, manager])).toEqual([1, 1]);
    expect(writes.filter(write => write.path.includes('/employees/'))).toEqual([
      {path: 'users/site/employees/inactive', data: {dailyPoints: {'9-16-2026': '1'}}},
    ]);
    expect(inactive.expectedPoints).toEqual({'9-16-2026': 1});
  });

  it('manager and individual totals include a no-payment expected-only day', () => {
    const {service} = create();
    const employee = {expectedPointsSince: '9-15-2026', dailyPoints: {'9-15-2026': '10'}, expectedPoints: {'9-15-2026': 10, '9-16-2026': 10}};
    expect(service.findAverageAndTotal(employee)).toEqual([10, 20]);
    expect(service.findAverageAndTotalAllEmployee([employee])).toEqual([10, 20]);
    expect(service.findTotalToday([employee])).toBe('10.00');
  });
});
