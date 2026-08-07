import { BehaviorSubject } from 'rxjs';

import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { isActivelyFollowedClient } from 'src/app/utils/active-followed-client.util';
import { TeamPageComponent } from './team-page.component';

describe('TeamPageComponent', () => {
  function createComponent() {
    const clients$ = new BehaviorSubject<Client[]>([]);
    const employees$ = new BehaviorSubject<Employee[]>([]);
    const auth = {
      getAllClients: () => clients$,
      getAllEmployees: () => employees$,
      isAdmin: true,
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
});
