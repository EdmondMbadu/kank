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

  describe('fresh audio requirement', () => {
    let data: any;
    let storage: any;
    const freshFile = () => new File(['audio'], 'current.m4a', {
      type: 'audio/mp4', lastModified: new Date(2026, 9, 6, 11).getTime(),
    });

    beforeEach(() => {
      data = { setClientFields: jasmine.createSpy('setClientFields').and.resolveTo() };
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
  });
});
