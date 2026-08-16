import { Client, ClientGalleryPicture } from '../models/client';

export const PAYMENT_RESPONSIBILITY_DOCUMENT_TYPE =
  'payment_responsibility' as const;
export const PAYMENT_RESPONSIBILITY_MAX_FILE_SIZE = 20 * 1024 * 1024;

export function isPaymentResponsibilityDocument(
  picture?: Partial<ClientGalleryPicture> | null
): boolean {
  return picture?.documentType === PAYMENT_RESPONSIBILITY_DOCUMENT_TYPE;
}

export function paymentResponsibilityDocuments(
  client?: Client | null
): ClientGalleryPicture[] {
  return Object.entries(client?.galleryPictures ?? {})
    .filter(([, picture]) =>
      Boolean(picture?.url?.trim() && isPaymentResponsibilityDocument(picture))
    )
    .map(([id, picture]) => ({
      ...picture,
      id: picture.id || id,
      category: 'other' as const,
      mediaType: 'image' as const,
      uploadedAt: picture.uploadedAt || new Date(0).toISOString(),
    }))
    .sort((a, b) => paymentResponsibilityDateValue(b) - paymentResponsibilityDateValue(a));
}

export function latestPaymentResponsibilityDocument(
  client?: Client | null
): ClientGalleryPicture | undefined {
  return paymentResponsibilityDocuments(client)[0];
}

export function resolveClientPortalClient(
  clients: Client[] | null | undefined,
  routeId: string | null | undefined
): Client | undefined {
  const list = Array.isArray(clients) ? clients.filter(Boolean) : [];
  const requestedId = String(routeId ?? '').trim();
  if (!requestedId) return undefined;

  const stableMatch = list.find((client) => client.uid === requestedId);
  if (stableMatch) return stableMatch;

  if (!/^\d+$/.test(requestedId)) return undefined;
  const legacyIndex = Number(requestedId);
  return Number.isSafeInteger(legacyIndex) ? list[legacyIndex] : undefined;
}

export function hasLinkedPaymentResponsibleClient(
  picture?: Partial<ClientGalleryPicture> | null
): boolean {
  return Boolean(
    isPaymentResponsibilityDocument(picture) &&
      picture?.paymentResponsibleClientId?.trim()
  );
}

export function currentDateTimeLocal(date = new Date()): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
    '.',
    pad(date.getMilliseconds(), 3),
  ].join('');
}

export function dateTimeLocalToISO(value: string): string | undefined {
  if (!value?.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function cleanPaymentResponsibilityFileName(fileName: string): string {
  return (
    fileName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'document.jpg'
  );
}

export function formatPaymentResponsibilityDate(iso?: string): string {
  if (!iso) return 'Date non renseignée';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Date non renseignée';
  return parsed.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function paymentResponsibilityDateValue(
  picture: Partial<ClientGalleryPicture>
): number {
  const effective = new Date(
    picture.paymentResponsibilityEffectiveAt || picture.uploadedAt || ''
  ).getTime();
  return Number.isNaN(effective) ? 0 : effective;
}
