import { AuditConversationAudioAttachment, Client } from '../models/client';

/** Dates written by the app are local M-D-YYYY[-H-m-s]; recordings use ISO. */
function parseAudioDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const appDate = raw.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})(?:-(\d{1,2})-(\d{1,2})-(\d{1,2}))?$/
  );
  const isoDay = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (appDate || isoDay) {
    const year = Number(appDate ? appDate[3] : isoDay![1]);
    const month = Number(appDate ? appDate[1] : isoDay![2]);
    const day = Number(appDate ? appDate[2] : isoDay![3]);
    const hour = Number(appDate?.[4] || 0);
    const minute = Number(appDate?.[5] || 0);
    const second = Number(appDate?.[6] || 0);
    const date = new Date(year, month - 1, day, hour, minute, second);
    return date.getFullYear() === year && date.getMonth() === month - 1 &&
      date.getDate() === day && date.getHours() === hour &&
      date.getMinutes() === minute && date.getSeconds() === second ? date : null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function auditConversationCycleStartedAt(client: Client): string | undefined {
  // dateOfRequest also changes for savings/refunds and edits. New registrations
  // retain a separate boundary throughout the cycle, including after delivery.
  return client.auditConversationCycleStartedAt ||
    (client.type === 'register' || client.requestType === 'lending'
      ? client.dateOfRequest : undefined);
}

export function isAuditAudioRecordedBeforeCycle(
  client: Client,
  recordedAt?: string,
  fileName?: string
): boolean {
  const start = parseAudioDate(auditConversationCycleStartedAt(client));
  if (!start) return false;
  const recording = parseAudioDate(recordedAt);
  // WhatsApp names retain their recording day even if copying/downloading the
  // file replaces lastModified. Only recognize its explicit AUD/PTT convention.
  const whatsapp = fileName?.match(/^(?:AUD|PTT)-(\d{4})(\d{2})(\d{2})-WA\d+\./i);
  const namedDay = whatsapp
    ? parseAudioDate(`${whatsapp[1]}-${whatsapp[2]}-${whatsapp[3]}`) : null;
  // A call made earlier on the registration day is valid. File timestamps do
  // not reliably establish which minute the conversation actually happened.
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  return Boolean((recording && recording < startDay) || (namedDay && namedDay < startDay));
}

export function currentAuditConversationAudios(
  client?: Client | null
): AuditConversationAudioAttachment[] {
  if (!client) return [];
  const attachments: AuditConversationAudioAttachment[] = client.auditConversationAudios !== undefined
    ? (Array.isArray(client.auditConversationAudios) ? client.auditConversationAudios : [])
    : client.auditConversationAudioUrl ? [{
      url: client.auditConversationAudioUrl,
      name: client.auditConversationAudioName,
      mimeType: client.auditConversationAudioMimeType,
      recordedAt: client.auditConversationAudioRecordedAt,
      recordedAtSource: client.auditConversationAudioRecordedAtSource,
      uploadedAt: client.auditConversationAudioUploadedAt,
      uploadedBy: client.auditConversationAudioUploadedBy,
    }] : [];
  const start = parseAudioDate(auditConversationCycleStartedAt(client));
  const cycle = String(client.debtCycle || '1');
  return attachments.filter((audio) => {
    if (!audio?.url?.trim()) return false;
    if (audio.debtCycle && String(audio.debtCycle) !== cycle) return false;
    if (!start && client.type === 'register' && !audio.debtCycle) return false;
    if (isAuditAudioRecordedBeforeCycle(client, audio.recordedAt, audio.name)) return false;
    if (start) {
      // Legacy attachments have no cycle tag. Never let missing/invalid upload
      // dates prove that such a file was attached for a new registration.
      const uploaded = parseAudioDate(audio.uploadedAt);
      if (!uploaded || uploaded < start) return false;
    }
    return true;
  });
}

export function emptyAuditConversationAudioFields(): Partial<Client> {
  // Clear both formats: legacy scalar fields must not resurrect an old file.
  return {
    auditConversationAudios: [],
    auditConversationAudioUrl: '',
    auditConversationAudioName: '',
    auditConversationAudioMimeType: '',
    auditConversationAudioRecordedAt: '',
    auditConversationAudioRecordedAtSource: '',
    auditConversationAudioUploadedAt: '',
    auditConversationAudioUploadedBy: '',
  };
}
