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

describe('InvestigationComponent feedback diagnostics', () => {
  function setup() {
    const data = {
      logInvestigationMediaError: jasmine.createSpy('logInvestigationMediaError'),
      uploadCommentFile: jasmine.createSpy('uploadCommentFile')
        .and.resolveTo('https://example.test/audio'),
    };
    const component = new InvestigationComponent(
      { isInvestigator: true } as any,
      { todaysDate: () => '10-17-2026-10-0-0' } as any,
      data as any, {} as any, {} as any, {} as any, {} as any
    );
    component.clients = [{ uid: 'client-1', locationOwnerId: 'site-1' }];
    component.feedbackClientId = 'client-1';
    component.feedbackVerifierName = 'Investigator';
    component.investigationAccessEmployee = { uid: 'employee-1' };
    component.dayKey = '10-17-2026';
    spyOn(window, 'alert');
    return { component, data };
  }

  it('logs an audio format rejection while preserving the existing alert', () => {
    const { component, data } = setup();
    const file = new File(['unknown'], 'recording.bin');
    component.onFeedbackAudioSelected([file] as unknown as FileList);
    expect(data.logInvestigationMediaError).toHaveBeenCalledWith(
      { code: 'validation/unsupported-audio' },
      jasmine.objectContaining({ clientId: 'client-1', investigatorId: 'employee-1' }),
      'validation', file
    );
    expect(window.alert).toHaveBeenCalledOnceWith('Veuillez sélectionner un audio.');
    expect(component.selectedFeedbackAudioFile).toBeUndefined();
  });

  it('logs an oversized audio without changing the 20 MB limit', () => {
    const { component, data } = setup();
    const file = new File(['audio'], 'recording.m4a', { type: 'audio/mp4' });
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 + 1 });
    component.onFeedbackAudioSelected([file] as unknown as FileList);
    expect(data.logInvestigationMediaError).toHaveBeenCalledWith(
      { code: 'validation/file-too-large' }, jasmine.anything(), 'validation', file
    );
    expect(window.alert).toHaveBeenCalledOnceWith("L'audio dépasse la limite de 20MB.");
    expect(component.selectedFeedbackAudioFile).toBeUndefined();
  });

  it('passes the selected investigator and client to upload diagnostics', async () => {
    const { component, data } = setup();
    const file = new File(['audio'], 'recording.m4a', { type: 'audio/mp4' });
    component.selectedFeedbackAudioFile = file;
    const finalize = spyOn<any>(component, 'finalizeFeedbackPost');
    (component as any).uploadFeedbackMediaAndPost();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(data.uploadCommentFile).toHaveBeenCalledOnceWith(
      file, 'client-feedback/audios/site-1/client-1/10-17-2026-10-0-0-recording.m4a',
      {
        ownerId: 'site-1', clientId: 'client-1', dayKey: '10-17-2026',
        investigatorId: 'employee-1', verifierName: 'Investigator',
      }
    );
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(data.logInvestigationMediaError).not.toHaveBeenCalled();
  });
});
