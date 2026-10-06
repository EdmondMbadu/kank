import { AuditConversationAudioAttachment, Client } from '../models/client';
import {
  currentAuditConversationAudios,
  isAuditAudioRecordedBeforeCycle,
} from './audit-conversation-audio.util';

describe('current cycle audit conversation audio', () => {
  let client: Client;
  const oldAudio: AuditConversationAudioAttachment = {
    url: 'https://example.com/may.m4a',
    name: 'AUD-20260509-WA0070.m4a',
    recordedAt: new Date(2026, 4, 9, 14, 35).toISOString(),
    uploadedAt: '5-9-2026-14-40-0',
  };
  const freshAudio: AuditConversationAudioAttachment = {
    url: 'https://example.com/october.m4a',
    recordedAt: new Date(2026, 9, 6, 9).toISOString(),
    uploadedAt: '10-6-2026-11-0-0',
  };

  beforeEach(() => {
    client = Object.assign(new Client(), {
      type: 'register', debtCycle: '2', dateOfRequest: '10-6-2026-10-0-0',
      // Delivery is in the future; it is not the start of the registration.
      requestDate: '10-9-2026',
    });
  });

  it('hides the May recording carried into an October registration', () => {
    client.auditConversationAudios = [oldAudio];
    expect(currentAuditConversationAudios(client)).toEqual([]);
    expect(client.auditConversationAudios).toEqual([oldAudio]);
  });

  it('also hides previous-cycle legacy scalar audio', () => {
    client.auditConversationAudioUrl = oldAudio.url;
    client.auditConversationAudioRecordedAt = oldAudio.recordedAt;
    client.auditConversationAudioUploadedAt = oldAudio.uploadedAt;
    expect(currentAuditConversationAudios(client)).toEqual([]);
  });

  it('accepts current array and legacy uploads before the planned delivery', () => {
    client.auditConversationAudios = [oldAudio, freshAudio];
    expect(currentAuditConversationAudios(client)).toEqual([freshAudio]);
    client.auditConversationAudios = undefined;
    client.auditConversationAudioUrl = freshAudio.url;
    client.auditConversationAudioRecordedAt = freshAudio.recordedAt;
    client.auditConversationAudioUploadedAt = freshAudio.uploadedAt;
    expect(currentAuditConversationAudios(client).map((audio) => audio.url)).toEqual([freshAudio.url]);
  });

  it('does not resurrect scalar audio when the array was explicitly cleared', () => {
    client.auditConversationAudios = [];
    client.auditConversationAudioUrl = freshAudio.url;
    client.auditConversationAudioUploadedAt = freshAudio.uploadedAt;
    expect(currentAuditConversationAudios(client)).toEqual([]);
  });

  it('rejects old recordings even when uploaded again during the current cycle', () => {
    client.auditConversationAudios = [{ ...oldAudio, uploadedAt: freshAudio.uploadedAt, debtCycle: '2' }];
    expect(currentAuditConversationAudios(client)).toEqual([]);
  });

  it('rejects a previous cycle tag even when timestamps look fresh', () => {
    client.auditConversationAudios = [{ ...freshAudio, debtCycle: '1' }];
    expect(currentAuditConversationAudios(client)).toEqual([]);
  });

  it('rejects dated WhatsApp audio when copying the file replaced its timestamp', () => {
    client.auditConversationAudios = [{ ...freshAudio, name: oldAudio.name, debtCycle: '2' }];
    expect(currentAuditConversationAudios(client)).toEqual([]);
    expect(isAuditAudioRecordedBeforeCycle(client, freshAudio.recordedAt, 'PTT-20260509-WA0070.opus')).toBeTrue();
    expect(isAuditAudioRecordedBeforeCycle(client, freshAudio.recordedAt, 'AUD-20261006-WA0070.m4a')).toBeFalse();
  });

  it('rejects an untagged previous upload earlier on the same registration day', () => {
    client.auditConversationAudios = [{ ...freshAudio, uploadedAt: '10-6-2026-9-59-59' }];
    expect(currentAuditConversationAudios(client)).toEqual([]);
  });

  it('requires a valid upload date for legacy audio on a new registration', () => {
    for (const uploadedAt of [undefined, '', 'invalid', '2-30-2026-12-0-0']) {
      client.auditConversationAudios = [{ ...freshAudio, uploadedAt }];
      expect(currentAuditConversationAudios(client)).toEqual([]);
    }
    client.dateOfRequest = 'invalid';
    client.auditConversationAudios = [oldAudio];
    expect(currentAuditConversationAudios(client)).toEqual([]);
  });

  it('uses the stable boundary after edits, delivery, and later savings requests', () => {
    client.auditConversationCycleStartedAt = client.dateOfRequest;
    client.dateOfRequest = '11-1-2026-12-0-0';
    client.type = '';
    client.requestType = 'savings';
    client.auditConversationAudios = [{ ...freshAudio, debtCycle: '2' }, oldAudio];
    expect(currentAuditConversationAudios(client)).toEqual([{ ...freshAudio, debtCycle: '2' }]);
  });

  it('keeps a previous recording available on its original cycle snapshot', () => {
    const previous = { ...client, debtCycle: '1', dateOfRequest: '5-9-2026-10-0-0', auditConversationAudios: [oldAudio] };
    expect(currentAuditConversationAudios(previous)).toEqual([oldAudio]);
  });

  it('handles missing records, malformed arrays, and blank URLs', () => {
    expect(currentAuditConversationAudios(null)).toEqual([]);
    client.auditConversationAudios = null as any;
    expect(currentAuditConversationAudios(client)).toEqual([]);
    client.auditConversationAudios = [{ ...freshAudio, url: '' }];
    expect(currentAuditConversationAudios(client)).toEqual([]);
  });

  it('accepts calls earlier on registration day but rejects earlier days', () => {
    expect(isAuditAudioRecordedBeforeCycle(client, freshAudio.recordedAt)).toBeFalse();
    expect(isAuditAudioRecordedBeforeCycle(client, oldAudio.recordedAt)).toBeTrue();
    client.auditConversationCycleStartedAt = '2026-10-06';
    expect(isAuditAudioRecordedBeforeCycle(client, new Date(2026, 9, 5, 23, 59).toISOString())).toBeTrue();
  });
});
