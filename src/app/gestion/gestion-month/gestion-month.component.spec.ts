import { of } from 'rxjs';
import { GestionMonthComponent } from './gestion-month.component';

describe('GestionMonthComponent management hydration', () => {
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
});
