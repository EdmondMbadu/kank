import { firstValueFrom, of } from 'rxjs';
import { CANONICAL_MANAGEMENT_DOCUMENT_ID } from '../models/management';
import { AuthService } from './auth.service';

describe('AuthService management ledger', () => {
  function managementService(management: Record<string, any> | undefined) {
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue({
        valueChanges: () => of(management),
      }),
      collection: jasmine.createSpy('collection'),
    };
    const firestoreV2 = {
      hydrateDocument: jasmine
        .createSpy('hydrateDocument')
        .and.callFake((_path: string, value: Record<string, any>) => of(value)),
    };
    const service = Object.create(AuthService.prototype) as AuthService;
    (service as any).afs = afs;
    (service as any).firestoreV2 = firestoreV2;
    (service as any).managementInfo$ = undefined;

    return { afs, firestoreV2, service };
  }

  it('reads only the canonical management document and attaches its id', async () => {
    const { afs, firestoreV2, service } = managementService({
      moneyInHands: '100000',
      reserve: {},
    });

    const result = await firstValueFrom(service.getManagementInfo());
    const path = `management/${CANONICAL_MANAGEMENT_DOCUMENT_ID}`;

    expect(afs.doc).toHaveBeenCalledOnceWith(path);
    expect(afs.collection).not.toHaveBeenCalled();
    expect(firestoreV2.hydrateDocument).toHaveBeenCalledWith(
      path,
      jasmine.objectContaining({ id: CANONICAL_MANAGEMENT_DOCUMENT_ID })
    );
    expect(result).toEqual([
      jasmine.objectContaining({
        id: CANONICAL_MANAGEMENT_DOCUMENT_ID,
        moneyInHands: '100000',
      }),
    ]);
  });

  it('returns no management data when the canonical document is absent', async () => {
    const { firestoreV2, service } = managementService(undefined);

    const result = await firstValueFrom(service.getManagementInfo());

    expect(result).toEqual([]);
    expect(firestoreV2.hydrateDocument).not.toHaveBeenCalled();
  });

  it('refuses global management writes when the resolved id is not canonical', async () => {
    const { afs, service } = managementService({});
    (service as any).managementDocId = 'undefined';

    await expectAsync(
      service.updateRolePasswords({
        admin: 'admin-secret',
        gestion: 'gestion-secret',
        investigator: 'investigator-secret',
      })
    ).toBeRejectedWith('Aucun document management trouvé.');

    expect(afs.doc).not.toHaveBeenCalled();
  });
});
