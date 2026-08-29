import { Client } from 'src/app/models/client';

import { InvestigationComponent } from './investigation.component';

describe('InvestigationComponent profession editor', () => {
  function createComponent(isAdmin: boolean, isInvestigator: boolean) {
    const auth = { isAdmin, isInvestigator } as any;
    const data = {
      updateClientInvestigationFieldsForUser: jasmine
        .createSpy('updateClientInvestigationFieldsForUser')
        .and.resolveTo(undefined),
      updateClientInvestigationFields: jasmine
        .createSpy('updateClientInvestigationFields')
        .and.resolveTo(undefined),
    } as any;
    const component = new InvestigationComponent(
      auth,
      {} as any,
      data,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    return { component, data };
  }

  it('allows only admins and investigators to open the profession editor', () => {
    for (const [isAdmin, isInvestigator, expected] of [
      [true, false, true],
      [false, true, true],
      [false, false, false],
    ] as const) {
      const { component } = createComponent(isAdmin, isInvestigator);
      component.activeClient = { uid: 'client-1', profession: 'Commerce' };

      component.openProfessionEditModal();

      expect(component.canEditClientProfession).toBe(expected);
      expect(component.showProfessionEditModal).toBe(expected);
    }
  });

  it('saves an investigator profession edit to the selected site and local lists', async () => {
    const { component, data } = createComponent(false, true);
    const visibleClient: Client = {
      uid: 'client-1',
      profession: 'Commerce',
      locationOwnerId: 'site-1',
    };
    const allClient: Client = { ...visibleClient };
    component.activeClient = visibleClient;
    component.clients = [visibleClient];
    component.allClients = [allClient];
    component.openProfessionEditModal();
    component.professionEditValue = '  Vente de vêtements  ';

    component.saveClientProfession();
    await Promise.resolve();

    expect(
      data.updateClientInvestigationFieldsForUser
    ).toHaveBeenCalledWith('site-1', 'client-1', {
      profession: 'Vente de vêtements',
    });
    expect(component.activeClient.profession).toBe('Vente de vêtements');
    expect(component.clients[0].profession).toBe('Vente de vêtements');
    expect(component.allClients[0].profession).toBe('Vente de vêtements');
    expect(component.showProfessionEditModal).toBeFalse();
  });

  it('does not save a profession edit for another role', () => {
    const { component, data } = createComponent(false, false);
    component.activeClient = { uid: 'client-1', profession: 'Commerce' };
    component.professionEditValue = 'Vente de vêtements';

    component.saveClientProfession();

    expect(
      data.updateClientInvestigationFieldsForUser
    ).not.toHaveBeenCalled();
    expect(data.updateClientInvestigationFields).not.toHaveBeenCalled();
  });
});
