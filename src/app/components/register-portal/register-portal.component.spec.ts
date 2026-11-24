import { RegiserPortalComponent } from './register-portal.component';
import { Client } from 'src/app/models/client';

describe('RegiserPortalComponent', () => {
  let component: RegiserPortalComponent;

  beforeEach(() => {
    component = new RegiserPortalComponent(
      {} as any,
      {
        snapshot: {
          paramMap: { get: () => '7' },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formats the client request submission date in French', () => {
    component.client.dateOfRequest = '8-11-2026-9-30-0';

    const label = (component as any).resolveRequestSubmittedDateLabel();

    expect(label).toBe('mardi 11 août 2026');
  });

  it('formats the planned delivery date while preserving its compact value', () => {
    component.requestDate = '14/3/2026';

    component.requestDeliveryDateLabel = (component as any).formatFrenchLongDate(
      '3-14-2026'
    );

    expect(component.requestDeliveryDateLabel).toBe('samedi 14 mars 2026');
    expect(component.requestDate).toBe('14/3/2026');
  });

  it('prefers the matching audit request date over the client fallback', () => {
    component.client.dateOfRequest = '8-10-2026';

    const label = (component as any).resolveRequestSubmittedDateLabel({
      dateOfRequest: '8-11-2026',
    });

    expect(label).toBe('mardi 11 août 2026');
  });

  it('uses an audit timestamp fallback when dateOfRequest is absent', () => {
    const label = (component as any).resolveRequestSubmittedDateLabel({
      requestedAt: '2026-08-11T15:30:00.000Z',
    });

    expect(label).toContain('11 août 2026');
  });

  it('returns an empty label when no valid request date exists', () => {
    component.client.dateOfRequest = 'not-a-date';
    component.client.dateJoined = 'also-not-a-date';

    const label = (component as any).resolveRequestSubmittedDateLabel();

    expect(label).toBe('');
  });

  describe('audit dialog page scrolling', () => {
    let originalBodyStyles: string;
    let restoreScroll: jasmine.Spy;

    beforeEach(() => {
      originalBodyStyles = document.body.style.cssText;
      spyOnProperty(window, 'scrollX', 'get').and.returnValue(0);
      spyOnProperty(window, 'scrollY', 'get').and.returnValue(640);
      restoreScroll = spyOn(window, 'scrollTo');
    });

    afterEach(() => {
      component.closeAuditConfirmation();
      document.body.style.cssText = originalBodyStyles;
    });

    it('keeps the background page fixed at its current position', () => {
      component.isConfirmed = true;

      component.confirmAudit();

      expect(component.showAuditConfirmation).toBeTrue();
      expect(component.isConfirmed).toBeFalse();
      expect(document.body.style.position).toBe('fixed');
      expect(document.body.style.top).toBe('-640px');
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores existing page styles and position when the dialog closes', () => {
      document.body.style.position = 'relative';
      document.body.style.top = '2px';
      document.body.style.left = '3px';
      document.body.style.width = '95%';
      document.body.style.overflow = 'auto';
      const existingStyles = document.body.style.cssText;
      component.confirmAudit();
      component.confirmAudit();

      component.closeAuditConfirmation();

      expect(component.showAuditConfirmation).toBeFalse();
      expect(document.body.style.cssText).toBe(existingStyles);
      expect(restoreScroll).toHaveBeenCalledOnceWith(0, 640);
    });

    it('releases the page when navigating away with the dialog open', () => {
      component.confirmAudit();

      component.ngOnDestroy();

      expect(document.body.style.cssText).toBe(originalBodyStyles);
      expect(restoreScroll).toHaveBeenCalledOnceWith(0, 640);
    });
  });

  describe('fresh audio requirement', () => {
    let data: any;
    let storage: any;
    const freshFile = () => new File(['audio'], 'current.m4a', {
      type: 'audio/mp4', lastModified: new Date(2026, 9, 6, 11).getTime(),
    });

    beforeEach(() => {
      data = {
        setClientFields: jasmine.createSpy('setClientFields').and.resolveTo(),
        logAuditVerificationError: jasmine.createSpy('logAuditVerificationError'),
        uploadAuditAudioBytes: jasmine.createSpy('uploadAuditAudioBytes').and.resolveTo({
          ref: { getDownloadURL: async () => 'https://example.com/recovered.m4a' },
        }),
      };
      storage = { upload: jasmine.createSpy('upload').and.resolveTo({
        ref: { getDownloadURL: async () => 'https://example.com/current.m4a' },
      }) };
      component = new RegiserPortalComponent(
        { isAdmin: true, currentUser: { firstName: 'Audit' } } as any,
        { snapshot: { paramMap: { get: () => '89' } } } as any,
        {} as any,
        { todaysDate: () => '10-6-2026-12-0-0' } as any,
        data, {} as any, storage
      );
      component.client = Object.assign(new Client(), {
        uid: 'delvaux-client', type: 'register', debtCycle: '2',
        dateOfRequest: '10-6-2026-10-0-0', requestDate: '10-9-2026',
        auditConversationAudios: [{
          url: 'https://example.com/old.m4a', uploadedAt: '5-9-2026-14-40-0',
          recordedAt: new Date(2026, 4, 9, 14, 35).toISOString(),
        }],
      });
      component.isConfirmed = true;
      spyOn(window, 'alert');
    });

    it('requires new audio and blocks confirmation when only May audio is saved', async () => {
      expect(component.hasPersistedAuditConversationAudio).toBeFalse();
      expect(component.canConfirmAudit).toBeFalse();
      expect(component.shouldShowAuditAudioRequirementMessage).toBeTrue();
      await component.setClientFieldAgent('agentVerifyingName', 'Audit');
      expect(data.setClientFields).not.toHaveBeenCalled();
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects selecting an old file and clears any previously selected file', () => {
      component.selectedAuditAudioFile = freshFile();
      const oldFile = new File(['audio'], 'AUD-20260509-WA0070.m4a', {
        type: 'audio/x-m4a', lastModified: new Date(2026, 4, 9).getTime(),
      });
      component.onAuditAudioSelected([oldFile] as any);
      expect(component.selectedAuditAudioFile).toBeUndefined();
      expect(component.canConfirmAudit).toBeFalse();
      expect(window.alert).toHaveBeenCalledWith(jasmine.stringMatching('antérieur'));
    });

    it('blocks both save paths if the selected file becomes stale after a cycle change', async () => {
      component.selectedAuditAudioFile = freshFile();
      component.client.dateOfRequest = '11-1-2026-10-0-0';
      expect(component.canConfirmAudit).toBeFalse();
      await component.saveAuditConversationAudioOnly();
      await component.setClientFieldAgent('agentVerifyingName', 'Audit');
      expect(data.setClientFields).not.toHaveBeenCalled();
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects the old WhatsApp file even if its filesystem date is refreshed', () => {
      const copiedFile = new File(['audio'], 'AUD-20260509-WA0070.m4a', {
        type: 'audio/mp4', lastModified: freshFile().lastModified,
      });
      component.onAuditAudioSelected([copiedFile] as any);
      expect(component.selectedAuditAudioFile).toBeUndefined();
      expect(component.canConfirmAudit).toBeFalse();
    });

    it('allows a fresh standalone upload despite the carried-over audio', async () => {
      component.selectedAuditAudioFile = freshFile();
      await component.saveAuditConversationAudioOnly();
      const fields = data.setClientFields.calls.mostRecent().args[1];
      expect(fields.auditConversationAudios.length).toBe(1);
      expect(fields.auditConversationAudios[0].url).toBe('https://example.com/current.m4a');
      expect(fields.auditConversationAudios[0].debtCycle).toBe('2');
      expect(fields.auditConversationCycleStartedAt).toBe('10-6-2026-10-0-0');
      expect(fields.agentSubmittedVerification).toBeUndefined();
      expect(component.hasPersistedAuditConversationAudio).toBeTrue();
    });

    it('persists fresh audio together with confirmation and the cycle association', async () => {
      component.selectedAuditAudioFile = freshFile();
      spyOn(component, 'removeClientFromPending').and.resolveTo();
      await component.setClientFieldAgent('agentVerifyingName', 'Audit');
      const fields = data.setClientFields.calls.mostRecent().args[1];
      expect(fields.agentSubmittedVerification).toBe('true');
      expect(fields.auditConversationAudios.length).toBe(1);
      expect(fields.auditConversationAudios[0].debtCycle).toBe('2');
      expect(component.hasPersistedAuditConversationAudio).toBeTrue();
    });

    it('can confirm an audio supplied without a file timestamp', async () => {
      component.selectedAuditAudioFile = new File(['audio'], 'Enregistrement d’appel.m4a', {
        type: 'audio/mp4', lastModified: 0,
      });
      // Match Firestore's rejection of undefined nested values.
      data.setClientFields.and.callFake(async (_id: string, fields: unknown) => {
        JSON.stringify(fields, (_key, value) => {
          if (value === undefined) throw new Error('Unsupported field value: undefined');
          return value;
        });
      });
      spyOn(component, 'removeClientFromPending').and.resolveTo();

      await component.setClientFieldAgent('agentVerifyingName', 'Audit');

      expect(component.client.agentSubmittedVerification).toBe('true');
      expect(component.client.auditConversationAudios![0].recordedAtSource).toBe('uploadTime');
      expect(data.logAuditVerificationError).not.toHaveBeenCalled();
    });

    it('reports upload failure without saving verification or discarding the selected file', async () => {
      const file = freshFile();
      component.selectedAuditAudioFile = file;
      const error = { code: 'storage/unauthorized' };
      storage.upload.and.rejectWith(error);

      await component.setClientFieldAgent('agentVerifyingName', 'Audit');

      expect(data.setClientFields).not.toHaveBeenCalled();
      expect(data.logAuditVerificationError).toHaveBeenCalledWith(error, 'delvaux-client', 'upload', file);
      expect(window.alert).toHaveBeenCalledWith(jasmine.stringMatching('Accès refusé.*storage/unauthorized'));
      expect(component.selectedAuditAudioFile).toBe(file);
      expect(component.auditVerificationSaving).toBeFalse();
      expect(component.auditAudioUploading).toBeFalse();
      expect(data.uploadAuditAudioBytes).not.toHaveBeenCalled();
    });

    it('distinguishes download URL failure from upload failure', async () => {
      component.selectedAuditAudioFile = freshFile();
      const error = { code: 'storage/unknown' };
      storage.upload.and.resolveTo({ ref: { getDownloadURL: async () => { throw error; } } });

      await component.setClientFieldAgent('agentVerifyingName', 'Audit');

      expect(data.setClientFields).not.toHaveBeenCalled();
      expect(data.logAuditVerificationError.calls.mostRecent().args[2]).toBe('download-url');
      expect(window.alert).toHaveBeenCalledWith(jasmine.stringMatching('lien est indisponible'));
    });

    it('includes the server rejection in an unknown upload error', async () => {
      component.selectedAuditAudioFile = freshFile();
      const error = {
        code: 'storage/unknown', status: 412,
        customData: { serverResponse: '{"error":{"message":"Upload service unavailable"}}' },
      };
      storage.upload.and.rejectWith(error);
      data.uploadAuditAudioBytes.and.rejectWith(error);

      await component.setClientFieldAgent('agentVerifyingName', 'Audit');

      expect(window.alert).toHaveBeenCalledWith(jasmine.stringMatching(
        'storage/unknown[\\s\\S]*HTTP 412 : Upload service unavailable'
      ));
      expect(data.setClientFields).not.toHaveBeenCalled();
    });

    it('confirms after a rejected resumable upload succeeds through the byte fallback', async () => {
      component.selectedAuditAudioFile = new File(['audio'], 'Enregistrement d’appel.m4a', {
        type: 'audio/x-m4a', lastModified: freshFile().lastModified,
      });
      storage.upload.and.rejectWith({ code: 'storage/unknown', status: 400 });
      spyOn(component, 'removeClientFromPending').and.resolveTo();

      await component.setClientFieldAgent('agentVerifyingName', 'Audit');

      const [path, file, metadata] = storage.upload.calls.mostRecent().args;
      expect(file.type).toBe('audio/mp4');
      expect(data.uploadAuditAudioBytes).toHaveBeenCalledOnceWith(path, file, metadata);
      const fields = data.setClientFields.calls.mostRecent().args[1];
      expect(fields.agentSubmittedVerification).toBe('true');
      expect(fields.auditConversationAudios[0].url).toBe('https://example.com/recovered.m4a');
      expect(fields.auditConversationAudios[0].debtCycle).toBe('2');
      expect(component.removeClientFromPending).toHaveBeenCalled();
    });

    it('reports a database failure separately and leaves the client pending', async () => {
      component.selectedAuditAudioFile = freshFile();
      data.setClientFields.and.rejectWith({ code: 'permission-denied' });
      spyOn(component, 'removeClientFromPending').and.resolveTo();

      await component.setClientFieldAgent('agentVerifyingName', 'Audit');

      expect(data.logAuditVerificationError.calls.mostRecent().args[2]).toBe('save-audit');
      expect(component.client.agentSubmittedVerification).not.toBe('true');
      expect(component.removeClientFromPending).not.toHaveBeenCalled();
    });
  });
});
