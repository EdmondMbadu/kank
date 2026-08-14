import { of, Subject } from 'rxjs';
import { NotPaidComponent } from './not-paid.component';

describe('NotPaidComponent management hydration', () => {
  it('uses reconstructed management settings through the existing API', () => {
    const management$ = new Subject<any[]>();
    const auth = {
      getAllClients: () => of([]),
      getAllEmployees: () => of([]),
      getManagementInfo: () => management$,
    };
    const component = new NotPaidComponent(
      auth as any,
      {} as any,
      {} as any,
      {} as any
    );
    const computeCycle = spyOn<any>(component, 'computeCycleNotFinished');
    const computeNoPay = spyOn<any>(component, 'computeNoPayList');
    component.ngOnInit();

    management$.next([{
      notPaidCycleMonthsThreshold: 8,
      notPaidNoPaymentMonthsThreshold: 6,
    }]);

    expect(component.monthsThreshold).toBe(8);
    expect(component.noPayMonthsThreshold).toBe(6);
    expect(computeCycle).toHaveBeenCalled();
    expect(computeNoPay).toHaveBeenCalled();
    component.ngOnDestroy();
  });
});
