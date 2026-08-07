import { of } from 'rxjs';

import { Client } from 'src/app/models/client';
import { UpdateClientInfoComponent } from './update-client-info.component';

describe('UpdateClientInfoComponent', () => {
  function createComponent(clientWrite: Promise<void>) {
    const router = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    } as any;
    const data = {
      updateClientInfo: jasmine
        .createSpy('updateClientInfo')
        .and.returnValue(clientWrite),
      updateEmployeeInfoForClientAgentAssignment: jasmine
        .createSpy('updateEmployeeInfoForClientAgentAssignment')
        .and.resolveTo(),
    } as any;
    const auth = {
      getAllClients: () => of([]),
      getAllEmployees: () => of([]),
    } as any;
    const route = {
      snapshot: { paramMap: { get: () => '4' } },
    } as any;
    const component = new UpdateClientInfoComponent(
      auth,
      route,
      router,
      data
    );
    component.client = {
      uid: 'client-4',
      firstName: 'Client',
      lastName: 'Test',
      middleName: 'A',
      phoneNumber: '0000000000',
      businessAddress: 'Adresse',
      profession: 'Commerce',
      paymentDay: 'Monday',
      agent: 'employee-1',
      vitalStatus: 'Quitté',
    } as Client;
    component.employees = [
      { uid: 'employee-1', firstName: 'Agent', clients: ['client-4'] },
    ];
    return { component, data, router };
  }

  it('does not navigate until the client status write succeeds', async () => {
    let resolveWrite!: () => void;
    const clientWrite = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    const { component, data, router } = createComponent(clientWrite);

    const updatePromise = component.updateClientInfo();
    await Promise.resolve();

    expect(data.updateClientInfo).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();

    resolveWrite();
    await updatePromise;

    expect(router.navigate).toHaveBeenCalledWith(['/client-portal/4']);
  });

  it('stays on the edit page when the client status write fails', async () => {
    spyOn(window, 'alert');
    spyOn(console, 'error');
    const { component, router } = createComponent(
      Promise.reject(new Error('write failed'))
    );

    await component.updateClientInfo();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(
      'Erreur lors de la mise à jour des informations du client'
    );
  });
});
