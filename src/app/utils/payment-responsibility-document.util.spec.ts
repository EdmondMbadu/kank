import { Client } from '../models/client';
import {
  currentDateTimeLocal,
  dateTimeLocalToISO,
  hasLinkedPaymentResponsibleClient,
  latestPaymentResponsibilityDocument,
  paymentResponsibilityDocuments,
  resolveClientPortalClient,
} from './payment-responsibility-document.util';

describe('payment responsibility document utilities', () => {
  it('keeps local hours, minutes, seconds, and milliseconds in the default value', () => {
    const date = new Date(2026, 7, 15, 9, 7, 6, 45);

    expect(currentDateTimeLocal(date)).toBe('2026-08-15T09:07:06.045');
    expect(dateTimeLocalToISO(currentDateTimeLocal(date))).toBe(date.toISOString());
  });

  it('returns only responsibility documents with the newest effective date first', () => {
    const client = {
      galleryPictures: {
        regular: {
          id: 'regular',
          category: 'other',
          url: 'https://example.com/regular.jpg',
          path: 'regular.jpg',
          size: 100,
          uploadedAt: '2026-08-15T09:00:00.000Z',
        },
        older: {
          id: 'older',
          category: 'other',
          documentType: 'payment_responsibility',
          url: 'https://example.com/older.jpg',
          path: 'older.jpg',
          size: 100,
          uploadedAt: '2026-08-15T09:00:00.000Z',
          paymentResponsibilityEffectiveAt: '2026-08-15T09:30:00.123Z',
        },
        newest: {
          id: 'newest',
          category: 'other',
          documentType: 'payment_responsibility',
          url: 'https://example.com/newest.jpg',
          path: 'newest.jpg',
          size: 100,
          uploadedAt: '2026-08-15T10:00:00.000Z',
          paymentResponsibilityEffectiveAt: '2026-08-15T10:00:00.456Z',
        },
      },
    } as Client;

    expect(paymentResponsibilityDocuments(client).map((picture) => picture.id)).toEqual([
      'newest',
      'older',
    ]);
    expect(latestPaymentResponsibilityDocument(client)?.id).toBe('newest');
  });

  it('resolves stable client ids while preserving legacy numeric portal links', () => {
    const clients = [
      { uid: 'client-a', firstName: 'Amina' },
      { uid: 'client-b', firstName: 'Benoit' },
    ] as Client[];

    expect(resolveClientPortalClient(clients, 'client-b')?.firstName).toBe('Benoit');
    expect(resolveClientPortalClient(clients, '0')?.firstName).toBe('Amina');
    expect(resolveClientPortalClient(clients, 'missing')).toBeUndefined();
  });

  it('treats only responsibility documents with a client id as linked', () => {
    expect(
      hasLinkedPaymentResponsibleClient({
        documentType: 'payment_responsibility',
        paymentResponsibleClientId: 'client-b',
      })
    ).toBeTrue();
    expect(
      hasLinkedPaymentResponsibleClient({
        documentType: 'payment_responsibility',
        paymentResponsibleName: 'Benoit',
      })
    ).toBeFalse();
  });
});
