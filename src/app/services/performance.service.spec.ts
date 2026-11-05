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
    return {service: new PerformanceService(auth, time, afs), auth, clients, employees, writes, afs};
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

  it('awards 1.8 points for a 130000 FC payoff with a 70000 FC installment, even on an unscheduled day', async () => {
    const {service, employees, writes} = create();
    employees.next([{uid: 'agent', clients: ['client'], dailyPoints: {},
      expectedPoints: {'9-16-2026': 0}, expectedPointsSince: '9-16-2026'}]);
    await service.updateUserPerformance({uid: 'client', amountToPay: '560000',
      paymentPeriodRange: '8', debtCycleStartDate: '8-13-2026'}, '130000');
    expect(writes.filter(w => w.path.includes('/employees/'))).toEqual([
      {path: 'users/site/employees/agent', data: {dailyPoints: {'9-16-2026': '1.8'}}},
    ]);
    expect(service.employees![0].expectedPoints!['9-16-2026']).toBe(0);
  });

  it('surfaces employee write rejection to the background error handler', async () => {
    const {service, employees, afs} = create();
    employees.next([{uid: 'agent', clients: ['client'], dailyPoints: {}, expectedPointsSince: '9-16-2026'}]);
    const error = new Error('employee write failed');
    spyOn(afs, 'doc').and.callFake((path: string) => ({set: () =>
      path.includes('/employees/') ? Promise.reject(error) : Promise.resolve()}));
    await expectAsync(service.updateUserPerformance({uid: 'client', amountToPay: '1000',
      paymentPeriodRange: '10', debtCycleStartDate: '9-1-2026'}, '100')).toBeRejectedWith(error);
  });

  it('does not count a savings-only zero repayment as a paid client in team performance', () => {
    const {service, clients} = create();
    clients.next([{uid: 'client', paymentDay: 'Wednesday', debtLeft: '500',
      amountToPay: '1000', amountPaid: '500', paymentPeriodRange: '10',
      debtCycleStartDate: '9-1-2026', payments: {'9-16-2026-10-00-00': '0'},
      savingsPayments: {'9-16-2026-10-00-00': '140000'}}]);
    expect(service.paidToday).toEqual([]);
    expect(service.haveNotPaidToday.length).toBe(1);
    expect(service.performance).toBe('-1');
  });

  it('still counts an actual repayment accompanied by savings as a paid client', () => {
    const {service, clients} = create();
    clients.next([{uid: 'client', paymentDay: 'Wednesday', debtLeft: '500',
      amountToPay: '1000', amountPaid: '500', paymentPeriodRange: '10',
      debtCycleStartDate: '9-1-2026', payments: {'9-16-2026-10-00-00': '100'},
      savingsPayments: {'9-16-2026-10-00-00': '140000'}}]);
    expect(service.paidToday.length).toBe(1);
    expect(service.haveNotPaidToday).toEqual([]);
    expect(service.performance).toBe('5');
  });
});
