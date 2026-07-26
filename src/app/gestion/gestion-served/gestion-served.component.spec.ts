import { of } from 'rxjs';
import { GestionServedComponent } from './gestion-served.component';

describe('GestionServedComponent confirmed saves', () => {
  let component: GestionServedComponent;
  let data: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;

  beforeEach(() => {
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(window, 'alert');

    data = jasmine.createSpyObj('DataService', [
      'updateManagementInfoForMoneyGiven',
    ]);
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));

    const auth = {
      currentUser: { firstName: 'Audit' },
      isAdmin: false,
      getManagementInfo: () =>
        of([
          {
            id: 'management-1',
            moneyInHands: '1000000',
            moneyGiven: {},
          },
        ]),
    };
    const compute = {
      convertCongoleseFrancToUsDollars: (amount: string) => amount,
    };
    const time = {
      convertTimeFormat: (value: string) => value,
      parseFlexibleDateTime: (value: string) => new Date(value),
    };

    component = new GestionServedComponent(
      auth as any,
      data,
      router,
      compute as any,
      time as any
    );
    component.reserveAmount = '200000';
  });

  it('blocks duplicate submissions until Firestore confirms', async () => {
    let confirmWrite!: () => void;
    data.updateManagementInfoForMoneyGiven.and.returnValue(
      new Promise<void>((resolve) => {
        confirmWrite = resolve;
      })
    );

    const firstSave = component.addToReserve();
    await component.addToReserve();

    expect(component.isSavingServed).toBeTrue();
    expect(data.updateManagementInfoForMoneyGiven).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();

    confirmWrite();
    await firstSave;

    expect(router.navigate).toHaveBeenCalledOnceWith(['/gestion-today']);
    expect(component.isSavingServed).toBeFalse();
  });

  it('does not navigate when Firestore rejects the write', async () => {
    data.updateManagementInfoForMoneyGiven.and.returnValue(
      Promise.reject(new Error('offline'))
    );

    await component.addToReserve();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalled();
    expect(component.reserveAmount).toBe('200000');
    expect(component.isSavingServed).toBeFalse();
  });
});
