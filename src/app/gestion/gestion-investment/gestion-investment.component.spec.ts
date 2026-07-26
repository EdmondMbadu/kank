import { of } from 'rxjs';
import { GestionInvestmentComponent } from './gestion-investment.component';

describe('GestionInvestmentComponent confirmed saves', () => {
  let component: GestionInvestmentComponent;
  let data: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;

  beforeEach(() => {
    spyOn(window, 'confirm').and.returnValue(true);

    data = jasmine.createSpyObj('DataService', [
      'updateManagementInfoForAddToInvestment',
      'deleteManagementInvestmentEntry',
    ]);
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));

    const auth = {
      currentUser: { firstName: 'Audit' },
      getManagementInfo: () =>
        of([
          {
            id: 'management-1',
            moneyInHands: '1000000',
            investment: {},
          },
        ]),
    };
    const compute = {
      sortArrayByDateDescendingOrder: (entries: any[]) => entries,
      convertCongoleseFrancToUsDollars: (amount: string) => amount,
    };
    const time = {
      convertTimeFormat: (value: string) => value,
      parseFlexibleDateTime: (value: string) => new Date(value),
    };

    component = new GestionInvestmentComponent(
      auth as any,
      data,
      router,
      compute as any,
      time as any
    );
    component.investmentAmount = '100000';
  });

  it('waits for confirmation and prevents duplicate investment writes', async () => {
    let confirmWrite!: () => void;
    data.updateManagementInfoForAddToInvestment.and.returnValue(
      new Promise<void>((resolve) => {
        confirmWrite = resolve;
      })
    );

    const firstSave = component.addToInvestment();
    await component.addToInvestment();

    expect(component.isSavingInvestment).toBeTrue();
    expect(data.updateManagementInfoForAddToInvestment).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();

    confirmWrite();
    await firstSave;

    expect(router.navigate).toHaveBeenCalledOnceWith(['/gestion-today']);
    expect(component.isSavingInvestment).toBeFalse();
  });

  it('retains the investment form after rejection', async () => {
    data.updateManagementInfoForAddToInvestment.and.returnValue(
      Promise.reject(new Error('write-failed'))
    );

    await component.addToInvestment();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.investmentAmount).toBe('100000');
    expect(component.feedbackType).toBe('error');
    expect(component.isSavingInvestment).toBeFalse();
  });
});
