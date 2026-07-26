import { of } from 'rxjs';
import { GestionBankComponent } from './gestion-bank.component';

describe('GestionBankComponent confirmed saves', () => {
  let component: GestionBankComponent;
  let data: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;
  let compute: jasmine.SpyObj<any>;

  beforeEach(() => {
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(window, 'alert');

    data = jasmine.createSpyObj('DataService', [
      'updateManagementInfoToAddMoneyInTheBank',
      'deleteBankDepositEntry',
      'updateBankDepositEntry',
    ]);
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
    compute = jasmine.createSpyObj(
      'ComputationService',
      ['sortArrayByDateDescendingOrder', 'updateManagementRates', 'setRates'],
      { rateDollar: 2800, rateFranc: 0.000357 }
    );
    compute.sortArrayByDateDescendingOrder.and.callFake(
      (entries: any[]) => entries
    );

    const auth = {
      currentUser: { firstName: 'Audit' },
      getManagementInfo: () =>
        of([
          {
            id: 'management-1',
            moneyInHands: '1000000',
            bankDepositDollars: {},
            bankDepositFrancs: {},
          },
        ]),
    };
    const time = {
      convertTimeFormat: (value: string) => value,
    };

    component = new GestionBankComponent(
      auth as any,
      data,
      router,
      compute,
      time as any
    );
    component.bankAmount = '280000';
    component.rateUsed = '2800';
    component.rateToday = '2800';
  });

  it('blocks duplicate bank deposits until confirmation', async () => {
    let confirmWrite!: () => void;
    data.updateManagementInfoToAddMoneyInTheBank.and.returnValue(
      new Promise<void>((resolve) => {
        confirmWrite = resolve;
      })
    );

    const firstSave = component.addToBank();
    await component.addToBank();

    expect(component.isSavingBankDeposit).toBeTrue();
    expect(
      data.updateManagementInfoToAddMoneyInTheBank
    ).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();

    confirmWrite();
    await firstSave;

    expect(router.navigate).toHaveBeenCalledOnceWith(['/gestion-today']);
    expect(component.isSavingBankDeposit).toBeFalse();
  });

  it('keeps the bank form open after a rejected deposit', async () => {
    data.updateManagementInfoToAddMoneyInTheBank.and.returnValue(
      Promise.reject(new Error('permission-denied'))
    );

    await component.addToBank();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.bankAmount).toBe('280000');
    expect(window.alert).toHaveBeenCalled();
    expect(component.isSavingBankDeposit).toBeFalse();
  });

  it('does not activate new rates until Firestore confirms them', async () => {
    compute.updateManagementRates.and.returnValue(
      Promise.reject(new Error('offline'))
    );
    component.showRateEditor = true;
    component.tmpRateDollar = 2900;
    component.tmpRateFranc = 0.000345;

    await component.saveRates();

    expect(compute.setRates).not.toHaveBeenCalled();
    expect(component.showRateEditor).toBeTrue();
    expect(component.isSavingRates).toBeFalse();
  });
});
