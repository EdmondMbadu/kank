import { Employee } from 'src/app/models/employee';
import { selectWinnerTeamMembers } from './winner-team-members';

describe('selectWinnerTeamMembers', () => {
  it('selects the team manager and marketing agent, excluding a regional manager', () => {
    const employees: Employee[] = [
      {
        firstName: 'Rebecca',
        lastName: 'Nkokori',
        role: 'Manager Regionale',
      },
      {
        firstName: 'Elise',
        lastName: 'Vuvu',
        role: 'Agent Marketing',
      },
      {
        firstName: 'Naomie',
        lastName: 'Luyeye',
        role: 'Manager',
      },
    ];

    expect(selectWinnerTeamMembers(employees)).toEqual([
      employees[2],
      employees[1],
    ]);
  });

  it('matches role labels regardless of case or surrounding whitespace', () => {
    const employees: Employee[] = [
      { firstName: 'Manager', role: '  MANAGER ' },
      { firstName: 'Agent', role: ' agent MARKETING  ' },
    ];

    expect(selectWinnerTeamMembers(employees)).toEqual(employees);
  });
});
