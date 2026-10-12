import { CardPhoneValidationService } from './card-phone-validation.service';
import { CardPhoneValidationError } from '../utils/card-phone-identity.util';

describe('CardPhoneValidationService', () => {
  const candidate = { firstName: 'Edmond', middleName: 'Mbadu', lastName: 'Ngoma', phoneNumber: '0812345678' };
  const guardPath = `cardPhoneWriteGuards/${candidate.phoneNumber}`;

  function setup(initial: Record<string, any> = {}, owners = ['site', 'other']) {
    const records = { ...initial };
    const snapshot = (path: string) => ({
      id: path.split('/').pop(), ref: { path }, exists: path in records,
      data: () => records[path],
    });
    const reads: { path: string; options: any }[] = [];
    const collection = jasmine.createSpy('collection').and.callFake((path: string) => ({
      get: async (options: any) => {
        reads.push({ path, options });
        return { docs: path === 'users'
          ? owners.map((uid) => ({ id: uid }))
          : Object.keys(records).filter((key) => key.startsWith(`${path}/`) &&
            key.slice(path.length + 1).indexOf('/') < 0).map(snapshot) };
      },
    }));
    const transaction = {
      get: jasmine.createSpy('transaction.get').and.callFake(async (ref: { path: string }) => snapshot(ref.path)),
      set: jasmine.createSpy('transaction.set'),
    };
    const firestore = {
      collection,
      doc: (path: string) => ({ path }),
      runTransaction: jasmine.createSpy('runTransaction').and.callFake(async (callback: any) => callback(transaction)),
    };
    const service = new CardPhoneValidationService({ firestore } as any);
    const write = jasmine.createSpy('write').and.callFake((tx: any) => {
      tx.set({ path: 'users/site/cards/new' }, candidate);
      tx.set({ path: 'users/site/cards/new/events/event' }, { type: 'card_created' });
    });
    return { service, firestore, transaction, records, reads, write };
  }

  it('performs a read-only precheck without a card, event or guard write', async () => {
    const { service, firestore, transaction, reads } = setup();
    await service.validate(candidate, 'site');
    expect(reads.length).toBe(5);
    expect(reads.every((read) => read.options.source === 'server')).toBeTrue();
    expect(firestore.runTransaction).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('rejects a conflict in the precheck without writing', async () => {
    const { service, firestore, transaction } = setup({
      'users/other/cards/old': { firstName: 'Sarah', phoneNumber: candidate.phoneNumber },
    });
    await expectAsync(service.validate(candidate, 'site'))
      .toBeRejectedWithError(CardPhoneValidationError, /Sarah/);
    expect(firestore.runTransaction).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('excludes the current card in the read-only renewal precheck', async () => {
    const { service, firestore } = setup({
      'users/site/cards/renew': { firstName: 'Old name', phoneNumber: candidate.phoneNumber },
    });
    await service.validate(candidate, 'site', 'renew');
    expect(firestore.runTransaction).not.toHaveBeenCalled();
  });

  it('does not reuse a stale successful precheck when saving', async () => {
    const { service, records, write } = setup();
    await service.validate(candidate, 'site');
    records['users/other/cards/added'] = { firstName: 'Sarah', phoneNumber: candidate.phoneNumber };
    await expectAsync(service.commit(candidate, 'site', 'new', write))
      .toBeRejectedWithError(CardPhoneValidationError, /Sarah/);
    expect(write).not.toHaveBeenCalled();
  });

  it('reads all locations from the server and atomically writes the card, event and phone guard', async () => {
    const { service, reads, write, transaction } = setup();
    await service.commit(candidate, 'site', 'new', write);
    expect(reads.map((read) => read.path)).toEqual([
      'users', 'users/site/cards', 'users/site/employees', 'users/other/cards', 'users/other/employees',
    ]);
    expect(reads.every((read) => read.options.source === 'server')).toBeTrue();
    expect(write).toHaveBeenCalledOnceWith(transaction);
    expect(transaction.set).toHaveBeenCalledTimes(3);
    expect(transaction.set).toHaveBeenCalledWith({ path: guardPath }, { cardPaths: ['users/site/cards/new'] });
  });

  it('blocks a differently named client at another location, including an ended card', async () => {
    const { service, write, firestore } = setup({
      'users/other/cards/old': { firstName: 'Sarah', phoneNumber: '+243 812 345 678', clientCardStatus: 'ended' },
    });
    await expectAsync(service.commit(candidate, 'site', 'new', write)).toBeRejectedWithError(CardPhoneValidationError, /Sarah/);
    expect(write).not.toHaveBeenCalled();
    expect(firestore.runTransaction).not.toHaveBeenCalled();
  });

  it('allows one shared name on cards in different locations', async () => {
    const { service, write } = setup({
      'users/other/cards/old': { firstName: 'Emdond', lastName: 'MBADU 2', phoneNumber: candidate.phoneNumber },
    });
    await service.commit(candidate, 'site', 'new', write);
    expect(write).toHaveBeenCalled();
  });

  it('blocks a known employee phone from another location despite a shared name', async () => {
    const { service, write } = setup({ 'users/other/employees/agent': candidate });
    await expectAsync(service.commit(candidate, 'site', 'new', write))
      .toBeRejectedWithError(CardPhoneValidationError, /appartient à un employé/);
    expect(write).not.toHaveBeenCalled();
  });

  it('excludes only the current document on renewal, including its prior guard entry', async () => {
    const { service, transaction, write } = setup({
      'users/site/cards/renew': { firstName: 'Old name', phoneNumber: candidate.phoneNumber },
      [guardPath]: { cardPaths: ['users/site/cards/renew'] },
    });
    await service.commit(candidate, 'site', 'renew', write, 'renew');
    expect(write).toHaveBeenCalled();
    expect(transaction.get).not.toHaveBeenCalledWith({ path: 'users/site/cards/renew' });
  });

  it('does not exclude another location document with the same card ID', async () => {
    const { service, write } = setup({
      'users/site/cards/renew': candidate,
      'users/other/cards/renew': { firstName: 'Sarah', phoneNumber: candidate.phoneNumber },
    });
    await expectAsync(service.commit(candidate, 'site', 'renew', write, 'renew'))
      .toBeRejectedWithError(CardPhoneValidationError, /Sarah/);
    expect(write).not.toHaveBeenCalled();
  });

  it('rejects invalid input without reading or writing Firestore', async () => {
    const { service, firestore, write } = setup();
    await expectAsync(service.commit({ ...candidate, phoneNumber: '081' }, 'site', 'new', write))
      .toBeRejectedWithError(CardPhoneValidationError, /10 chiffres/);
    expect(firestore.collection).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('fails closed if any location lookup fails and gives retry guidance', async () => {
    const { service, firestore, write } = setup();
    firestore.collection.and.callFake((path: string) => ({
      get: async () => {
        if (path === 'users/other/employees') throw new Error('permission-denied');
        return { docs: path === 'users' ? [{ id: 'other' }] : [] };
      },
    }));
    await expectAsync(service.commit(candidate, 'site', 'new', write))
      .toBeRejectedWithError(CardPhoneValidationError, 'Impossible de vérifier ce numéro. Vérifiez votre connexion et réessayez.');
    expect(write).not.toHaveBeenCalled();
  });

  it('includes the current location even if the user list omits it', async () => {
    const { service, write } = setup({ 'users/site/employees/agent': candidate }, ['other']);
    await expectAsync(service.commit(candidate, 'site', 'new', write))
      .toBeRejectedWithError(CardPhoneValidationError, /employé/);
    expect(write).not.toHaveBeenCalled();
  });

  it('catches a conflicting card committed after the scan through the phone guard', async () => {
    const { service, records, firestore, transaction, write } = setup();
    firestore.runTransaction.and.callFake(async (callback: any) => {
      records['users/other/cards/winner'] = { firstName: 'Sarah', phoneNumber: candidate.phoneNumber };
      records[guardPath] = { cardPaths: ['users/other/cards/winner'] };
      return callback(transaction);
    });
    await expectAsync(service.commit(candidate, 'site', 'new', write))
      .toBeRejectedWithError(CardPhoneValidationError, /Sarah/);
    expect(write).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('removes deleted/changed-phone claims so the old number can be reused', async () => {
    const { service, transaction, write } = setup({
      [guardPath]: { cardPaths: ['users/other/cards/deleted', 'users/other/cards/changed'] },
      'users/other/cards/changed': { firstName: 'Sarah', phoneNumber: '0893258653' },
    });
    await service.commit(candidate, 'site', 'new', write);
    expect(write).toHaveBeenCalled();
    expect(transaction.set).toHaveBeenCalledWith({ path: guardPath }, { cardPaths: ['users/site/cards/new'] });
  });

  it('rechecks imported matching cards during the transaction before writing', async () => {
    const { service, records, firestore, transaction, write } = setup({ 'users/other/cards/old': candidate });
    firestore.runTransaction.and.callFake(async (callback: any) => {
      records['users/other/cards/old'] = { firstName: 'Sarah', phoneNumber: candidate.phoneNumber };
      return callback(transaction);
    });
    await expectAsync(service.commit(candidate, 'site', 'new', write))
      .toBeRejectedWithError(CardPhoneValidationError, /Sarah/);
    expect(write).not.toHaveBeenCalled();
  });
});
