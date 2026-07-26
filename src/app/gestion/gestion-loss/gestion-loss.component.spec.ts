import { of } from 'rxjs';
import { GestionLossComponent } from './gestion-loss.component';

describe('GestionLossComponent confirmed saves', () => {
  let component: GestionLossComponent;
  let data: jasmine.SpyObj<any>;

  beforeEach(() => {
    spyOn(window, 'confirm').and.returnValue(true);

    data = jasmine.createSpyObj('DataService', [
      'updateManagementInfoForMoneyLoss',
      'deleteManagementExchangeLossEntry',
      'deleteManagementDollarTransferLossEntry',
      'updateManagementExchangeLossEntry',
      'updateManagementDollarTransferLossEntry',
    ]);

    const auth = {
      currentUser: { firstName: 'Audit' },
      getManagementInfo: () =>
        of([
          {
            id: 'management-1',
            moneyInHands: '1000000',
            exchangeLoss: {},
            dollarTransferLoss: {},
          },
        ]),
    };
    const compute = {
      sortArrayByDateDescendingOrder: (entries: any[]) => entries,
      convertCongoleseFrancToUsDollars: (amount: string) => amount,
      convertUsDollarsToCongoleseFranc: (amount: string) => amount,
    };
    const time = {
      convertTimeFormat: (value: string) => value,
      parseFlexibleDateTime: (value: string) => new Date(value),
    };

    component = new GestionLossComponent(
      auth as any,
      data,
      compute as any,
      time as any
    );
    component.lossAmount = '25000';
  });

  it('blocks duplicates and clears the amount only after confirmation', async () => {
    let confirmWrite!: () => void;
    data.updateManagementInfoForMoneyLoss.and.returnValue(
      new Promise<void>((resolve) => {
        confirmWrite = resolve;
      })
    );

    const firstSave = component.addLoss();
    await component.addLoss();

    expect(component.isSavingLoss).toBeTrue();
    expect(component.lossAmount).toBe('25000');
    expect(data.updateManagementInfoForMoneyLoss).toHaveBeenCalledTimes(1);

    confirmWrite();
    await firstSave;

    expect(component.lossAmount).toBe('');
    expect(component.feedbackType).toBe('success');
    expect(component.isSavingLoss).toBeFalse();
  });

  it('retains the amount and shows an error after rejection', async () => {
    data.updateManagementInfoForMoneyLoss.and.returnValue(
      Promise.reject(new Error('write-failed'))
    );

    await component.addLoss();

    expect(component.lossAmount).toBe('25000');
    expect(component.feedbackType).toBe('error');
    expect(component.feedbackMessage).toContain('write-failed');
    expect(component.isSavingLoss).toBeFalse();
  });
});
