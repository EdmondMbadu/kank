import { Subject } from 'rxjs';
import { GestionReserveComponent } from './gestion-reserve.component';

describe('GestionReserveComponent management hydration', () => {
  it('keeps historical reserve entries available to the page', () => {
    const management$ = new Subject<any[]>();
    const auth = { getManagementInfo: () => management$ };
    const management = { id: 'management-1', reserve: { old: '10' } };
    const component = new GestionReserveComponent(
      auth as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    spyOn(component, 'getCurrentReserve');

    management$.next([management]);

    expect(component.managementInfo).toBe(management as any);
    expect(component.getCurrentReserve).toHaveBeenCalled();
  });
});
