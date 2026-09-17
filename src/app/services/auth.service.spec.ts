import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { CANONICAL_MANAGEMENT_DOCUMENT_ID } from '../models/management';
import { AuthService } from './auth.service';

describe('AuthService performance budget settings', () => {
  function setup(isAdmin = true) {
    const set = jasmine.createSpy('set').and.resolveTo();
    const doc = jasmine.createSpy('doc').and.returnValue({ set });
    const service = Object.create(AuthService.prototype) as AuthService;
    Object.assign(service, {
      afs: { doc }, isAdmninistrator: isAdmin,
      managementDocId: CANONICAL_MANAGEMENT_DOCUMENT_ID,
      performanceBudgetProportionSubject: new BehaviorSubject(50),
    });
    return { service, doc, set };
  }

  it('persists only the proportion and publishes it after a successful save', async () => {
    const { service, doc, set } = setup();
    await service.updatePerformanceBudgetProportion(25);
    expect(doc).toHaveBeenCalledOnceWith(`management/${CANONICAL_MANAGEMENT_DOCUMENT_ID}`);
    expect(set).toHaveBeenCalledOnceWith({ performanceBudgetProportionPercent: 25 }, { merge: true });
    expect(service.performanceBudgetProportionPercent).toBe(25);
  });

  it('refuses non-admin, invalid, or noncanonical writes', async () => {
    const staff = setup(false);
    await expectAsync(staff.service.updatePerformanceBudgetProportion(50)).toBeRejected();
    expect(staff.doc).not.toHaveBeenCalled();
    const admin = setup();
    for (const percent of [-1, 101, NaN, Infinity]) {
      await expectAsync(admin.service.updatePerformanceBudgetProportion(percent)).toBeRejected();
    }
    (admin.service as any).managementDocId = 'undefined';
    await expectAsync(admin.service.updatePerformanceBudgetProportion(50)).toBeRejected();
    expect(admin.doc).not.toHaveBeenCalled();
  });

  it('keeps the saved proportion when Firestore rejects a write', async () => {
    const { service, set } = setup();
    set.and.rejectWith(new Error('permission-denied'));
    await expectAsync(service.updatePerformanceBudgetProportion(25)).toBeRejected();
    expect(service.performanceBudgetProportionPercent).toBe(50);
  });
});

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

describe('AuthService daily central snapshots', () => {
  it('uses a one-shot client query and hydrates only the requested month with document ids', async () => {
    const get = jasmine.createSpy('get').and.returnValue(of({
      empty: false, docs: [{ id: 'client-a', data: () => ({ firstName: 'Esther' }) }],
    }));
    const afs = { collection: jasmine.createSpy('collection').and.returnValue({ get }) };
    const firestoreV2 = { hydrateDocument: jasmine.createSpy('hydrateDocument')
      .and.callFake((_path: string, base: any) => of(base)) };
    const service = Object.create(AuthService.prototype) as AuthService;
    Object.assign(service as any, { afs, firestoreV2 });
    const result = await firstValueFrom(service.getClientsOfAUserForMonth('site-a', '2026-09'));
    expect(afs.collection).toHaveBeenCalledOnceWith('users/site-a/clients');
    expect(get).toHaveBeenCalledTimes(1);
    expect(firestoreV2.hydrateDocument).toHaveBeenCalledOnceWith(
      'users/site-a/clients/client-a', { firstName: 'Esther', uid: 'client-a' }, '2026-09'
    );
    expect(result[0].uid).toBe('client-a');
  });
});

describe('AuthService independent point expectations', () => {
  it('rotation copies keep identity/history but do not copy another site\'s frozen workload', async () => {
    const source = {
      uid: 'source-agent', clients: ['client'],
      expectedPoints: { '9-17-2026': 10 }, expectedPointsSince: '9-17-2026',
      dailyPoints: { '9-16-2026': '5' }, totalDailyPoints: { '9-16-2026': '10' },
    };
    const set = jasmine.createSpy('set').and.resolveTo();
    const afs = {
      createId: () => 'new-agent',
      doc: jasmine.createSpy('doc').and.callFake((path: string) =>
        path === 'users/source/employees/source-agent'
          ? { valueChanges: () => of(source) } : { set }),
    };
    const service = Object.create(AuthService.prototype) as AuthService;
    Object.assign(service as any, { afs });
    await service.copyEmployeeToLocation('source', 'source-agent', 'target', true);
    const payload = set.calls.mostRecent().args[0];
    expect(payload.expectedPoints).toBeUndefined();
    expect(payload.expectedPointsSince).toBeUndefined();
    expect(payload.dailyPoints).toEqual(source.dailyPoints);
    expect(payload.clients).toEqual([]);
    expect(payload.canonicalEmployeeId).toBe('source-agent');
    expect(payload.rotationSourceEmployeeId).toBe('source-agent');
    expect(source.expectedPoints['9-17-2026']).toBe(10);
  });
});
