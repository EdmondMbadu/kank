import { BehaviorSubject } from 'rxjs';

import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { isActivelyFollowedClient } from 'src/app/utils/active-followed-client.util';
import { TeamPageComponent } from './team-page.component';

describe('TeamPageComponent', () => {
  function createComponent(isAdmin = true) {
    const clients$ = new BehaviorSubject<Client[]>([]);
    const employees$ = new BehaviorSubject<Employee[]>([]);
    const auth = {
      getAllClients: () => clients$,
      getAllEmployees: () => employees$,
      isAdmin,
      isDistributor: false,
      isInvestigator: false,
      currentUser: { uid: 'owner-1' },
    } as any;
    const data = {
      findClientsWithDebts: (clients: Client[]) =>
        clients.filter(isActivelyFollowedClient),
    } as any;
    const time = {
      todaysDateMonthDayYear: () => '8-6-2026',
      getTomorrowsDateMonthDayYear: () => '8-7-2026',
      convertDateToDayMonthYear: () => '6 Août 2026',
      calculateAge: () => 30,
    } as any;
    const performance = {
      findAverageAndTotal: () => [0, 1],
      findAverageAndTotalAllEmployee: () => [0, 1],
      findLetterGrade: () => 'F',
    } as any;
    const compute = { roundNumber: (value: number) => value } as any;
    const router = { navigate: jasmine.createSpy('navigate') } as any;
    const component = new TeamPageComponent(
      router,
      auth,
      data,
      time,
      performance,
      {} as any,
      compute
    );
    return { component, clients$, employees$ };
  }

  const employee = (uid: string): Employee => ({
    uid,
    firstName: uid,
    role: 'Agent Marketing',
    status: 'Travaille',
    dateOfBirth: '1-1-1990',
    clients: [],
  });

  const client = (
    uid: string,
    agent: string,
    debtLeft = '100',
    vitalStatus = 'Vivant'
  ): Client => ({ uid, agent, debtLeft, vitalStatus });

  it('updates current counts immediately when clients leave or finish paying', () => {
    const { component, clients$, employees$ } = createComponent();
    employees$.next([employee('employee-1')]);
    clients$.next([
      client('active-1', 'employee-1'),
      client('active-2', 'employee-1'),
      client('left', 'employee-1', '100', 'Quitté'),
      client('finished', 'employee-1', '0'),
    ]);
    component.ngOnInit();

    expect(component.getEmployeeClientCount(component.employees[0])).toBe(2);
    expect(
      component.getEmployeeClientCount(component.employees[0], 'all')
    ).toBe(4);

    clients$.next([
      client('active-1', 'employee-1', '100', 'Quitté'),
      client('active-2', 'employee-1'),
      client('left', 'employee-1', '100', 'Quitté'),
      client('finished', 'employee-1', '0'),
    ]);
    expect(component.getEmployeeClientCount(component.employees[0])).toBe(1);

    clients$.next([
      client('active-1', 'employee-1', '100', 'Quitté'),
      client('active-2', 'employee-1', '0'),
      client('left', 'employee-1', '100', 'Quitté'),
      client('finished', 'employee-1', '0'),
    ]);
    expect(component.getEmployeeClientCount(component.employees[0])).toBe(0);
    expect(component.agentClientMap['employee-1']).toEqual([]);

    clients$.next([
      client('active-1', 'employee-1', '100', 'Quitté'),
      client('active-2', 'employee-1', '250', 'Vivant'),
      client('left', 'employee-1', '100', 'Quitté'),
      client('finished', 'employee-1', '0'),
    ]);
    expect(component.getEmployeeClientCount(component.employees[0])).toBe(1);

    component.ngOnDestroy();
  });

  it('moves a current count between employees when the assigned agent changes', () => {
    const { component, clients$, employees$ } = createComponent();
    employees$.next([employee('employee-1'), employee('employee-2')]);
    clients$.next([client('client-1', 'employee-1')]);
    component.ngOnInit();

    expect(component.getEmployeeClientCount(component.employees[0])).toBe(1);
    expect(component.getEmployeeClientCount(component.employees[1])).toBe(0);

    clients$.next([client('client-1', 'employee-2')]);

    expect(component.getEmployeeClientCount(component.employees[0])).toBe(0);
    expect(component.getEmployeeClientCount(component.employees[1])).toBe(1);

    component.ngOnDestroy();
  });

  it('deduplicates client ids without creating repeated live subscriptions', () => {
    const { component, clients$, employees$ } = createComponent();
    employees$.next([employee('employee-1')]);
    clients$.next([
      client('client-1', 'employee-1'),
      client('client-1', 'employee-1'),
    ]);
    component.ngOnInit();

    expect(component.getEmployeeClientCount(component.employees[0])).toBe(1);
    expect(clients$.observers.length).toBe(1);
    expect(employees$.observers.length).toBe(1);

    component.retreiveClients();
    component.retrieveEmployees();
    clients$.next([client('client-1', 'employee-1')]);

    expect(clients$.observers.length).toBe(1);
    expect(employees$.observers.length).toBe(1);

    component.ngOnDestroy();
    expect(clients$.observers.length).toBe(0);
    expect(employees$.observers.length).toBe(0);
  });

  it('keeps sick employees visible with the current team', () => {
    const { component, employees$ } = createComponent();
    const workingEmployee = employee('working');
    const sickEmployee = { ...employee('sick'), status: 'Malade' };
    const formerEmployee = { ...employee('former'), status: 'Quitté' };

    employees$.next([workingEmployee, sickEmployee, formerEmployee]);
    component.ngOnInit();

    expect(component.workingEmployees.map((entry) => entry.uid)).toEqual([
      'working',
      'sick',
    ]);
    expect(component.currentEmployeeCount).toBe(2);
    expect(component.employees).not.toContain(formerEmployee);

    component.ngOnDestroy();
  });

  it('prepares only the selected employee list on demand, including for staff', () => {
    const { component, clients$, employees$ } = createComponent(false);
    employees$.next([employee('employee-1'), employee('employee-2')]);
    clients$.next([
      { ...client('stable-uid', 'employee-1', '125000'), firstName: 'Aline',
        middleName: 'Mbuyi', lastName: 'Kanku', phoneNumber: '082 111 2233', trackingId: '999' },
      client('someone-else', 'employee-2'),
      client('finished', 'employee-1', '0'),
      client('left', 'employee-1', '100', 'Quitté'),
    ]);
    component.ngOnInit();
    expect(component.followedClientRows).toEqual([]);

    component.openFollowedClients(component.employees[0]);
    expect(component.followedClientRows.length).toBe(1);
    expect(component.followedClientRows[0].uid).toBe('stable-uid');
    expect(component.followedClientRows[0].name).toBe('Aline Mbuyi Kanku');
    expect(component.followedClientRows[0].phone).toBe('082 111 2233');
    expect(component.followedClientRows[0].debt.replace(/\s/g, '')).toBe('125000FC');
    expect(component.followedClientsTotalDebt.replace(/\s/g, '')).toBe('125000FC');

    component.closeFollowedClients();
    component.openFollowedClients(component.employees[1]);
    expect(component.followedClientRows.map((row) => row.uid)).toEqual(['someone-else']);
    expect(component.followedClientsTotalDebt).toBe('100 FC');
    expect(clients$.observers.length).toBe(1);
    expect(employees$.observers.length).toBe(1);
    component.closeFollowedClients();
    expect(component.followedClientRows).toEqual([]);
    expect(component.followedClientsTotalDebt).toBe('0 FC');
    component.ngOnDestroy();
  });

  it('matches the all-client count and handles zero or unknown debt honestly', () => {
    const { component, clients$, employees$ } = createComponent();
    employees$.next([employee('employee-1')]);
    clients$.next([
      client('active', 'employee-1'),
      client('finished', 'employee-1', '0'),
      client('left', 'employee-1', '100', 'Quitté'),
      client('unknown', 'employee-1', ''),
    ]);
    component.ngOnInit();
    component.setEmployeeScope('all');
    component.openFollowedClients(component.employees[0]);
    expect(component.followedClientRows.length).toBe(component.getEmployeeClientCount(component.employees[0]));
    expect(component.followedClientRows.find((row) => row.uid === 'finished')?.debt).toBe('0 FC');
    expect(component.followedClientRows.find((row) => row.uid === 'unknown')?.debt).toBe('—');
    expect(component.followedClientRows.find((row) => row.uid === 'unknown')?.phone).toBe('—');
    expect(component.followedClientsTotalDebt).toBe('200 FC');
    component.ngOnDestroy();
  });

  it('refreshes an open list from the existing stream when debts or assignments change', () => {
    const { component, clients$, employees$ } = createComponent();
    employees$.next([employee('employee-1'), employee('employee-2')]);
    clients$.next([client('active', 'employee-1', '100')]);
    component.ngOnInit();
    component.openFollowedClients(component.employees[0]);

    clients$.next([client('active', 'employee-1', '75')]);
    expect(component.followedClientRows[0].debt).toBe('75 FC');
    expect(component.followedClientsTotalDebt).toBe('75 FC');
    clients$.next([client('active', 'employee-2', '75')]);
    expect(component.followedClientRows).toEqual([]);
    expect(component.followedClientsTotalDebt).toBe('0 FC');
    expect(clients$.observers.length).toBe(1);

    employees$.next([employee('employee-2')]);
    expect(component.followedClientsEmployee).toBeNull();
    component.ngOnDestroy();
  });

  it('totals every followed client even beyond the initial modal batch', () => {
    const { component, clients$, employees$ } = createComponent();
    employees$.next([employee('employee-1')]);
    clients$.next([
      ...Array.from({ length: 60 }, (_, i) => client(`client-${i}`, 'employee-1', '125.5')),
      client('other-employee', 'employee-2', '100000'),
    ]);
    component.ngOnInit();
    component.openFollowedClients(component.employees[0]);
    expect(component.followedClientsTotalDebt.replace(/\s/g, '')).toBe('7530FC');
    component.ngOnDestroy();
  });
});
