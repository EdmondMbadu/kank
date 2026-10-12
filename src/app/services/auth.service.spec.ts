import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { CANONICAL_MANAGEMENT_DOCUMENT_ID } from '../models/management';
import { AuthService } from './auth.service';

describe('AuthService site deduction thresholds', () => {
  function setup(isAdmin = true) {
    const set = jasmine.createSpy('set').and.resolveTo();
    const doc = jasmine.createSpy('doc').and.returnValue({ set });
    const service = Object.create(AuthService.prototype) as AuthService;
    Object.assign(service, {
      afs: { doc }, isAdmninistrator: isAdmin,
      currentUser: { uid: 'site', weeklyPaymentTargetFc: '1200000' },
      weeklyPaymentTargetPeriodsState: [], weeklyPaymentTargetBaseState: 1200000,
      defaultWeeklyPaymentTargetFc: 600000,
      weeklyDeductionTargetVersionsState: [{ effectiveDateIso: '2026-09-01', targetFc: 900000 }],
    });
    return { service, doc, set };
  }

  it('resolves the same site exception for payroll and keeps the visible objective separate', () => {
    const { service } = setup();
    const site = { weeklyPaymentTargetFc: '1200000', weeklyDeductionTargetPeriods: [
      { startDateIso: '2026-09-14', endDateIso: '2026-09-20', targetFc: 700000 },
    ] };
    expect(service.resolveWeeklyDeductionTargetForDate('2026-09-17', site)).toBe(700000);
    expect(service.resolveWeeklyPaymentTargetForDate('2026-09-17', site)).toBe(1200000);
    expect(service.resolveWeeklyDeductionTargetForDate('2026-09-21', site)).toBe(900000);
    expect(service.resolveWeeklyDeductionTargetForDate('2026-08-31', site)).toBe(1200000);
  });

  it('saves only the site deduction periods without touching global or visible settings', async () => {
    const { service, doc, set } = setup();
    const periods = [{ startDateIso: '2026-09-14', endDateIso: '2026-09-20', targetFc: 700000 }];
    await service.updateWeeklyDeductionTargetPeriodsForCurrentUser(periods);
    expect(doc).toHaveBeenCalledOnceWith('users/site');
    expect(set).toHaveBeenCalledOnceWith({ weeklyDeductionTargetPeriods: periods }, { merge: true });
    expect(service.currentUser.weeklyPaymentTargetFc).toBe('1200000');
  });

  it('rejects staff and invalid periods without writing', async () => {
    const staff = setup(false);
    await expectAsync(staff.service.updateWeeklyDeductionTargetPeriodsForCurrentUser([])).toBeRejected();
    expect(staff.doc).not.toHaveBeenCalled();
    const admin = setup();
    await expectAsync(admin.service.updateWeeklyDeductionTargetPeriodsForCurrentUser([
      { startDateIso: 'bad', endDateIso: '2026-09-20', targetFc: 700000 },
    ])).toBeRejected();
    expect(admin.doc).not.toHaveBeenCalled();
  });
});

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

describe('AuthService card phone validation at save time', () => {
  function setup() {
    const validate = jasmine.createSpy('validate').and.resolveTo();
    const transaction = { set: jasmine.createSpy('transaction.set') };
    const commit = jasmine.createSpy('commit').and.callFake(async (
      _card: any, _owner: string, _uid: string, write: (tx: any) => void
    ) => write(transaction));
    const service = Object.create(AuthService.prototype) as AuthService;
    Object.assign(service, {
      afs: {
        createId: () => 'new-card',
        doc: (path: string) => ({ ref: { path } }),
        collection: (path: string) => ({ doc: () => ({ ref: { path: `${path}/event` } }) }),
      },
      currentUser: { uid: 'site' }, clientId: 'previous-card',
      cardPhoneValidation: { commit, validate },
      time: { todaysDate: () => '10-12-2026' },
    });
    const card = {
      uid: 'renew-card', firstName: 'Edmond', middleName: 'Mbadu', lastName: 'Ngoma',
      phoneNumber: '0812345678', homeAddress: 'Matete', businessAddress: 'Matete',
      profession: 'Vendeur', cardCycle: '3', amountPaidToday: '10000', amountToPay: '10000',
      payments: { '10-12-2026': '10000' },
    };
    return { service, commit, validate, transaction, card };
  }

  it('forwards the identity and current owner to a read-only precheck', async () => {
    const { service, validate, commit, transaction, card } = setup();
    await service.validateClientCardPhone(card);
    expect(validate).toHaveBeenCalledOnceWith(card, 'site', undefined);
    expect(commit).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
    expect(service.clientId).toBe('previous-card');
  });

  it('passes the renewal document ID to the precheck and preserves its rejection', async () => {
    const { service, validate, commit, card } = setup();
    const rejection = new Error('Phone rejected');
    validate.and.rejectWith(rejection);
    await expectAsync(service.validateClientCardPhone(card, card.uid)).toBeRejectedWith(rejection);
    expect(validate).toHaveBeenCalledOnceWith(card, 'site', 'renew-card');
    expect(commit).not.toHaveBeenCalled();
  });

  it('creates the card and its lifecycle event through the guarded transaction', async () => {
    const { service, commit, transaction, card } = setup();
    await service.addNewClientCard(card);
    expect(commit).toHaveBeenCalledOnceWith(card, 'site', 'new-card', jasmine.any(Function));
    expect(transaction.set).toHaveBeenCalledWith({ path: 'users/site/cards/new-card' },
      jasmine.objectContaining({ phoneNumber: '0812345678', cardCycle: '1', amountPaid: '10000' }), { merge: true });
    expect(transaction.set).toHaveBeenCalledWith({ path: 'users/site/cards/new-card/events/event' },
      jasmine.objectContaining({ type: 'card_created', phoneNumber: '0812345678', createdByUid: 'site' }));
    expect(service.clientId).toBe('new-card');
  });

  it('renews through the same guarded transaction, excluding only that card', async () => {
    const { service, commit, transaction, card } = setup();
    await service.startNewCardCycle(card);
    expect(commit).toHaveBeenCalledOnceWith(card, 'site', 'renew-card', jasmine.any(Function), 'renew-card');
    expect(transaction.set).toHaveBeenCalledWith({ path: 'users/site/cards/renew-card' },
      jasmine.objectContaining({ phoneNumber: '0812345678', cardCycle: '3', depositCount: '1' }), { merge: true });
    expect(transaction.set).toHaveBeenCalledWith({ path: 'users/site/cards/renew-card/events/event' },
      jasmine.objectContaining({ type: 'cycle_started', cycle: 3 }));
  });

  it('does not write or replace the last saved card ID when creation is rejected', async () => {
    const { service, commit, transaction, card } = setup();
    const rejection = new Error('Phone rejected');
    commit.and.rejectWith(rejection);
    await expectAsync(service.addNewClientCard(card)).toBeRejectedWith(rejection);
    expect(transaction.set).not.toHaveBeenCalled();
    expect(service.clientId).toBe('previous-card');
  });

  it('does not write a renewal or mutate the supplied card if validation fails', async () => {
    const { service, commit, transaction, card } = setup();
    commit.and.rejectWith(new Error('Phone rejected'));
    await expectAsync(service.startNewCardCycle(card)).toBeRejected();
    expect(transaction.set).not.toHaveBeenCalled();
    expect(card.cardCycle).toBe('3');
    expect(card.payments).toEqual({ '10-12-2026': '10000' });
  });
});
