import { GestionFraudeComponent } from './gestion-fraude.component';

describe('GestionFraudeComponent confirmed saves', () => {
  let component: GestionFraudeComponent;
  let data: jasmine.SpyObj<any>;

  beforeEach(() => {
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(window, 'alert');
    spyOn(console, 'error');

    data = jasmine.createSpyObj('DataService', [
      'updateManagementFraudEntry',
      'updateManagementInfoForAddFraud',
      'deleteManagementFraudEntry',
    ]);

    component = new GestionFraudeComponent(
      { currentUser: { firstName: 'Audit' } } as any,
      data,
      {} as any,
      {} as any
    );
    component.fraudAmount = '50000';
    component.fraudReason = 'Test';
    component.fraudLocation = 'Site A';
  });

  it('prevents duplicate fraud writes while confirmation is pending', async () => {
    let confirmWrite!: () => void;
    data.updateManagementInfoForAddFraud.and.returnValue(
      new Promise<void>((resolve) => {
        confirmWrite = resolve;
      })
    );

    const firstSave = component.saveFraud();
    await component.saveFraud();

    expect(component.isSaving).toBeTrue();
    expect(data.updateManagementInfoForAddFraud).toHaveBeenCalledTimes(1);

    confirmWrite();
    await firstSave;

    expect(component.isSaving).toBeFalse();
    expect(component.fraudAmount).toBe('');
  });

  it('keeps fraud values available after rejection', async () => {
    data.updateManagementInfoForAddFraud.and.returnValue(
      Promise.reject(new Error('offline'))
    );

    await component.saveFraud();

    expect(component.fraudAmount).toBe('50000');
    expect(component.fraudReason).toBe('Test');
    expect(component.fraudLocation).toBe('Site A');
    expect(component.isSaving).toBeFalse();
    expect(window.alert).toHaveBeenCalledWith("Erreur lors de l'enregistrement.");
  });
});
