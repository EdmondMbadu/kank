import { firstValueFrom, of, throwError } from 'rxjs';
import { fakeAsync, tick } from '@angular/core/testing';
import { FirestoreV2CompatService } from './firestore-v2-compat.service';

describe('Firestore compatibility month-scoped reads', () => {
  const path = 'users/site-a/clients/client-a';
  function createService(documents: Record<string, any>, control: any = {
    readFromV2: true, readKinds: ['client'],
  }) {
    const afs = {
      doc: jasmine.createSpy('doc').and.callFake((docPath: string) => ({
        valueChanges: () => documents[docPath] instanceof Error
          ? throwError(() => documents[docPath]) : of(documents[docPath]),
      })),
      collection: jasmine.createSpy('collection').and.returnValue({ valueChanges: () => of([]) }),
    };
    const service = Object.create(FirestoreV2CompatService.prototype) as FirestoreV2CompatService;
    (service as any).afs = afs;
    (service as any).readControl$ = of(control);
    return { service, afs };
  }

  it('reads only the selected compact month, preserving scalar identity and retained payments', async () => {
    const { service, afs } = createService({
      [`${path}/firestoreV2ReadMonths/2026-09`]: { maps: { previousPayments: { '9-1-2026': '100' } } },
    });
    const result = await firstValueFrom(service.hydrateDocument(path, {
      uid: 'client-a', payments: { '9-2-2026': '200' },
    }, '2026-09'));
    expect(afs.doc).toHaveBeenCalledOnceWith(`${path}/firestoreV2ReadMonths/2026-09`);
    expect(afs.collection).not.toHaveBeenCalled();
    expect(result).toEqual(jasmine.objectContaining({ uid: 'client-a', previousPayments: { '9-1-2026': '100' } }));
    expect(result.payments).toEqual({ '9-2-2026': '200' });
  });

  it('falls back to only the selected integrity month for archived data', async () => {
    const { service, afs } = createService({
      [`${path}/firestoreV2Months/2026-09`]: { items: {
        p: { id: 'p', sourcePath: path, field: 'previousPayments', legacyKey: '9-1-2026', value: '100' },
      } },
    });
    const result = await firstValueFrom(service.hydrateDocument(path, {
      _firestoreV2Archive: { through: '2026-09' },
    }, '2026-09'));
    expect(afs.doc.calls.allArgs()).toEqual([
      [`${path}/firestoreV2ReadMonths/2026-09`], [`${path}/firestoreV2Months/2026-09`],
    ]);
    expect(afs.collection).not.toHaveBeenCalled();
    expect((result as any).previousPayments).toEqual({ '9-1-2026': '100' });
  });

  it('accepts an absent month as no activity, not a reason to read every historical month', async () => {
    const { service, afs } = createService({});
    const base = { _firestoreV2Archive: { through: '2026-09' }, uid: 'a' };
    expect(await firstValueFrom(service.hydrateDocument(path, base, '2026-09'))).toEqual(base);
    expect(afs.collection).not.toHaveBeenCalled();
  });

  it('does not read projections when v2 is disabled', async () => {
    const { service, afs } = createService({}, { readFromV2: false });
    const base = { payments: { '9-1-2026': '100' } };
    expect(await firstValueFrom(service.hydrateDocument(path, base, '2026-09'))).toBe(base);
    expect(afs.doc).not.toHaveBeenCalled();
    expect(afs.collection).not.toHaveBeenCalled();
  });

  it('rejects malformed month paths before reading', async () => {
    const { service, afs } = createService({});
    await expectAsync(firstValueFrom(service.hydrateDocument(path, {}, '2026-09/other'))).toBeRejected();
    expect(afs.doc).not.toHaveBeenCalled();
  });

  it('keeps existing full-history callers on their original collection reader', async () => {
    const { service, afs } = createService({});
    await firstValueFrom(service.hydrateDocument(path, {}));
    expect(afs.collection).toHaveBeenCalledOnceWith(`${path}/firestoreV2ReadMonths`);
    expect(afs.doc).not.toHaveBeenCalled();
  });

  it('refuses a partial scoped history when the compact month read fails', fakeAsync(() => {
    spyOn(console, 'error');
    const error = new Error('Offline');
    const { service } = createService({ [`${path}/firestoreV2ReadMonths/2026-09`]: error });
    let rejected: unknown;
    firstValueFrom(service.hydrateDocument(path, { payments: { '9-1-2026': '100' } }, '2026-09'))
      .catch((reason) => rejected = reason);
    tick(3000);
    expect(rejected).toBe(error);
  }));

  it('refuses integrity fallbacks that contain unreadable chunked payment payloads', async () => {
    spyOn(console, 'error');
    const { service } = createService({
      [`${path}/firestoreV2Months/2026-09`]: { items: {
        p: { id: 'p', sourcePath: path, field: 'payments', payloadEncoding: 'chunks' },
      } },
    });
    await expectAsync(firstValueFrom(service.hydrateDocument(path, {
      _firestoreV2Archive: { through: '2026-09' },
    }, '2026-09'))).toBeRejected();
  });
});
