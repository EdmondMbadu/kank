import { CertificateComponent } from './certificate.component';

describe('CertificateComponent', () => {
  function createComponent(): CertificateComponent {
    return new CertificateComponent(
      {} as any,
      {} as any,
      {} as any,
      {
        yearsList: [2026],
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
      } as any,
      {} as any
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('includes former and vacationing employees only in the trophy history map', () => {
    const component = createComponent();
    const activeEmployee = {
      uid: 'active',
      firstName: 'Active',
      lastName: 'Employee',
      status: 'Travaille',
      bestEmployeeTrophies: [{ month: '1', year: '2026' }],
    } as any;
    const formerEmployee = {
      uid: 'former',
      firstName: 'Former',
      lastName: 'Employee',
      status: 'Ne travaille plus',
      bestTeamTrophies: [{ month: '2', year: '2025' }],
    } as any;
    const vacationingEmployee = {
      uid: 'vacation',
      firstName: 'Vacation',
      lastName: 'Employee',
      status: 'Vacances',
      bestEmployeeTrophies: [{ month: '3', year: '2024' }],
    } as any;
    const formerDuplicateOfActive = {
      uid: 'active-old-record',
      firstName: 'Active',
      lastName: 'Employee',
      status: 'Ne travaille plus',
      bestEmployeeTrophies: [{ month: '1', year: '2026' }],
      bestTeamTrophies: [{ month: '4', year: '2025' }],
    } as any;

    component.allEmployeesAll = [
      formerDuplicateOfActive,
      activeEmployee,
      formerEmployee,
      vacationingEmployee,
    ];

    expect(
      component.trophyHeatmapTiles.map((tile) => tile.employee.uid)
    ).toEqual(jasmine.arrayWithExactContents(['active', 'former', 'vacation']));
    expect(component.trophyHeatmapStats.employeesWithTrophies).toBe(3);
    const activeTile = component.trophyHeatmapTiles.find(
      (tile) => tile.employee.uid === 'active'
    );
    expect(activeTile?.total).toBe(2);
  });
});
