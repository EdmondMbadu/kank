import { Client } from '../models/client';
import { DataService } from './data.service';

describe('DataService', () => {
  it('accumulates savings-to-payment totals independently from daily payments', () => {
    const service = new DataService(
      {} as any,
      {} as any,
      {
        currentUser: {
          dailySavingsToPayment: { '8-23-2026': '20000' },
        },
      } as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-24-2026',
        todaysDate: () => '8-23-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );

    expect(service.computeDailySavingsToPayment('8-23-2026', '15000')).toBe(
      35000
    );
    expect(service.computeDailySavingsToPayment('8-24-2026', '10000')).toBe(
      '10000'
    );
  });

  it('marks a direct-only day in the existing payment write', async () => {
    const userRef = {
      set: jasmine.createSpy('set').and.resolveTo(undefined),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue(userRef),
    };
    const service = new DataService(
      afs as any,
      {} as any,
      {
        currentUser: {
          uid: 'owner-1',
          clientsSavings: '0',
          moneyInHands: '0',
          totalDebtLeft: '100000',
          dailyReimbursement: {},
          dailySaving: {},
        },
      } as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-24-2026',
        todaysDate: () => '8-23-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );

    await service.updateUserInfoForClientPayment(
      new Client(),
      '0',
      '8-23-2026',
      '15000'
    );

    expect(userRef.set).toHaveBeenCalledTimes(1);
    expect(userRef.set.calls.mostRecent().args[0].dailySavingsToPayment).toEqual(
      { '8-23-2026': '0' }
    );
  });

  it('groups one day of employee cash payments by team with one query', async () => {
    const docs = [
      {
        ref: {
          path: 'users/site-a/employees/employee-1/dayTotals/8-22-2026',
        },
        data: () => ({ total: 600, count: 1, dayKey: '8-22-2026' }),
      },
      {
        ref: {
          path: 'users/site-a/employees/employee-2/dayTotals/8-22-2026',
        },
        data: () => ({ collected: '400', count: 2, dayKey: '8-22-2026' }),
      },
      {
        ref: {
          path: 'users/site-b/employees/employee-3/dayTotals/8-22-2026',
        },
        data: () => ({ paid: 300, count: 1, dayKey: '8-22-2026' }),
      },
      {
        ref: {
          path: 'users/not-selected/employees/employee-4/dayTotals/8-22-2026',
        },
        data: () => ({ total: 9999, count: 1, dayKey: '8-22-2026' }),
      },
    ];
    const get = jasmine.createSpy('get').and.resolveTo({
      forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    });
    const where = jasmine.createSpy('where').and.returnValue({ get });
    const collectionGroup = jasmine
      .createSpy('collectionGroup')
      .and.returnValue({ where });
    const service = new DataService(
      { firestore: { collectionGroup } } as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-23-2026',
        todaysDate: () => '8-22-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );

    const result = await service.getEmployeeDayTotalsGroupedByTeam(
      '8-22-2026',
      ['site-a', 'site-b']
    );

    expect(collectionGroup).toHaveBeenCalledTimes(1);
    expect(collectionGroup).toHaveBeenCalledWith('dayTotals');
    expect(where).toHaveBeenCalledOnceWith('dayKey', '==', '8-22-2026');
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { ownerUid: 'site-a', total: 1000, count: 3 },
      { ownerUid: 'site-b', total: 300, count: 1 },
    ]);
  });

  it('groups one month of employee cash payments by team with one query', async () => {
    const docs = [
      {
        ref: { path: 'users/site-a/employees/employee-1/dayTotals/8-1-2026' },
        data: () => ({ total: 600, count: 1, monthKey: '2026-08' }),
      },
      {
        ref: { path: 'users/site-a/employees/employee-2/dayTotals/8-2-2026' },
        data: () => ({ collected: '400', count: 2, monthKey: '2026-08' }),
      },
      {
        ref: { path: 'users/site-b/employees/employee-3/dayTotals/8-3-2026' },
        data: () => ({ paid: 300, count: 1, monthKey: '2026-08' }),
      },
      {
        ref: { path: 'users/not-selected/dayTotals/8-4-2026' },
        data: () => ({ total: 9999, count: 1, monthKey: '2026-08' }),
      },
    ];
    const get = jasmine.createSpy('get').and.resolveTo({
      forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    });
    const where = jasmine.createSpy('where').and.returnValue({ get });
    const collectionGroup = jasmine
      .createSpy('collectionGroup')
      .and.returnValue({ where });
    const service = new DataService(
      { firestore: { collectionGroup } } as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-23-2026',
        todaysDate: () => '8-22-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );

    const result = await service.getEmployeeMonthTotalsGroupedByTeam(
      '2026-08',
      ['site-a', 'site-b']
    );

    expect(collectionGroup).toHaveBeenCalledTimes(1);
    expect(collectionGroup).toHaveBeenCalledWith('dayTotals');
    expect(where).toHaveBeenCalledOnceWith('monthKey', '==', '2026-08');
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { ownerUid: 'site-a', total: 1000, count: 3 },
      { ownerUid: 'site-b', total: 300, count: 1 },
    ]);
  });

  it('groups one week of employee cash payments with one range query', async () => {
    const docs = [
      {
        ref: { path: 'users/site-a/employees/employee-1/dayTotals/8-17-2026' },
        data: () => ({ total: 600, count: 1 }),
      },
      {
        ref: { path: 'users/site-a/employees/employee-2/dayTotals/8-21-2026' },
        data: () => ({ collected: '400', count: 2 }),
      },
      {
        ref: { path: 'users/site-b/employees/employee-3/dayTotals/8-23-2026' },
        data: () => ({ paid: 300, count: 1 }),
      },
    ];
    const get = jasmine.createSpy('get').and.resolveTo({
      forEach: (callback: (doc: any) => void) => docs.forEach(callback),
    });
    const endWhere = jasmine.createSpy('endWhere').and.returnValue({ get });
    const startWhere = jasmine
      .createSpy('startWhere')
      .and.returnValue({ where: endWhere });
    const collectionGroup = jasmine
      .createSpy('collectionGroup')
      .and.returnValue({ where: startWhere });
    const service = new DataService(
      { firestore: { collectionGroup } } as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-24-2026',
        todaysDate: () => '8-23-2026-12-00-00',
      } as any,
      {} as any,
      {} as any
    );
    const startMs = new Date(2026, 7, 17).getTime();
    const endMs = new Date(2026, 7, 23).getTime();

    const result = await service.getEmployeeWeekTotalsGroupedByTeam(
      startMs,
      endMs,
      ['site-a', 'site-b']
    );

    expect(collectionGroup).toHaveBeenCalledOnceWith('dayTotals');
    expect(startWhere).toHaveBeenCalledOnceWith(
      'dayStartMs',
      '>=',
      startMs
    );
    expect(endWhere).toHaveBeenCalledOnceWith('dayStartMs', '<=', endMs);
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { ownerUid: 'site-a', total: 1000, count: 3 },
      { ownerUid: 'site-b', total: 300, count: 1 },
    ]);
  });

  it('never writes NaN when cancelling a normal pending loan request', async () => {
    const userRef = {
      set: jasmine.createSpy('set').and.resolveTo(undefined),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue(userRef),
    };
    const auth = {
      currentUser: {
        uid: 'owner-1',
        monthBudgetPending: 'NaN',
        moneyInHands: '200000',
        clientsSavings: '50000',
        fees: '15000',
        dailySavingReturns: {},
        dailyFeesReturns: {},
      },
    };
    const service = new DataService(
      afs as any,
      {} as any,
      auth as any,
      {
        todaysDateMonthDayYear: () => '8-16-2026',
        todaysDate: () => '8-16-2026-10-00-00',
        getTomorrowsDateMonthDayYear: () => '8-17-2026',
      } as any,
      {
        computeDailySavingReturn: () => '0',
        computeDailyFeesReturn: () => '0',
      } as any,
      {} as any
    );
    const pendingClient = Object.assign(new Client(), {
      requestStatus: 'pending',
      requestType: 'lending',
      requestAmount: '100000',
      creditScore: '50',
      applicationFee: '5000',
      membershipFee: '10000',
      savings: '30000',
    });

    await service.UpdateUserInfoForCancelingdRegisteredClient(pendingClient);

    const writtenData = userRef.set.calls.mostRecent().args[0];
    expect(writtenData.monthBudgetPending).toBe('0');
    expect(writtenData.monthBudgetPending).not.toBe('NaN');
  });

  it('keeps a score-70 request from changing the legacy pending counter', async () => {
    const userRef = {
      set: jasmine.createSpy('set').and.resolveTo(undefined),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue(userRef),
    };
    const auth = {
      currentUser: {
        uid: 'owner-1',
        monthBudgetPending: '250000',
        numberOfClients: '10',
        clientsSavings: '0',
        fees: '0',
        moneyInHands: '0',
        dailySaving: {},
        dailyMoneyRequests: {},
        feesData: {},
      },
    };
    const service = new DataService(
      afs as any,
      {} as any,
      auth as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-17-2026',
        todaysDate: () => '8-16-2026-10-00-00',
      } as any,
      {
        computeDailyFees: () => '0',
        computeDailySaving: () => '0',
        computeDailyMoneyRequests: () => '0',
      } as any,
      {} as any
    );
    const bestClient = Object.assign(new Client(), {
      requestAmount: '500000',
      requestDate: '8-20-2026',
      creditScore: '70',
      savings: '0',
      applicationFee: '0',
      membershipFee: '0',
    });

    await service.updateUserInfoForRegisterClient(bestClient, '8-16-2026');

    expect(
      userRef.set.calls.mostRecent().args[0].monthBudgetPending
    ).toBe('250000');
  });

  it('appends a gallery picture to the selected site owner without replacing the gallery', async () => {
    const clientRef = {
      update: jasmine.createSpy('update').and.resolveTo(undefined),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue(clientRef),
    };
    const service = new DataService(
      afs as any,
      {} as any,
      { currentUser: { uid: 'investigator-account' } } as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-16-2026',
        todaysDate: () => '8-15-2026',
      } as any,
      {} as any,
      {} as any
    );
    const picture = {
      id: 'payment-responsibility-1',
      category: 'other',
      mediaType: 'image',
      url: 'https://example.com/document.jpg',
      path: 'client-gallery/client/site-2/client-9/payment-responsibility/document.jpg',
      size: 2048,
      uploadedAt: '2026-08-15T16:07:06.045Z',
      documentType: 'payment_responsibility',
      paymentResponsibleName: 'Marie Kavanda',
      paymentResponsibilityEffectiveAt: '2026-08-15T16:07:06.045Z',
    } as const;

    await service.addClientGalleryPictureForUser('site-2', 'client-9', picture);

    expect(afs.doc).toHaveBeenCalledWith('users/site-2/clients/client-9');
    expect(clientRef.update).toHaveBeenCalledWith({
      'galleryPictures.payment-responsibility-1': picture,
    });
  });

  it('persists phone history with a register request update', async () => {
    const clientRef = {
      set: jasmine.createSpy('set').and.resolveTo(undefined),
      update: jasmine.createSpy('update').and.resolveTo(undefined),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue(clientRef),
    };
    const service = new DataService(
      afs as any,
      {} as any,
      { currentUser: { uid: 'owner-1' } } as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-13-2026',
        todaysDate: () => '8-12-2026',
      } as any,
      {} as any,
      {} as any
    );

    await service.registerClientRequestUpdate({
      uid: 'client-1',
      phoneNumber: '0999999999',
      previousPhoneNumbers: ['0811111111'],
    });

    expect(afs.doc).toHaveBeenCalledWith(
      'users/owner-1/clients/client-1'
    );
    expect(clientRef.set).toHaveBeenCalledWith(
      jasmine.objectContaining({
        phoneNumber: '0999999999',
        previousPhoneNumbers: ['0811111111'],
      }),
      { merge: true }
    );
  });

  it('removes from the latest queue without losing a concurrent assignment', async () => {
    const auditRef = {};
    const transaction = {
      get: jasmine.createSpy('get').and.resolveTo({
        exists: true,
        data: () => ({
          pendingClients: [
            { clientId: 'joseph' },
            { clientId: 'marie' },
            { clientId: 'richard' },
          ],
        }),
      }),
      update: jasmine.createSpy('update'),
    };
    const afs = {
      doc: jasmine.createSpy('doc').and.returnValue({ ref: auditRef }),
      firestore: {
        runTransaction: (callback: (tx: any) => Promise<void>) =>
          callback(transaction),
      },
    };
    const service = new DataService(
      afs as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-8-2026',
        todaysDate: () => '8-7-2026',
      } as any,
      {} as any,
      {} as any
    );

    await service.removePendingClientFromAudit('helene', 'joseph');

    expect(transaction.get).toHaveBeenCalledWith(auditRef);
    expect(transaction.update).toHaveBeenCalledWith(auditRef, {
      pendingClients: [{ clientId: 'marie' }, { clientId: 'richard' }],
    });
  });

  it('finalizes attendance and its photo in one atomic batch', async () => {
    const refs = new Map<string, { path: string }>();
    const doc = (path: string) => {
      if (!refs.has(path)) refs.set(path, { path });
      return refs.get(path)!;
    };
    const batch = {
      set: jasmine.createSpy('set'),
      commit: jasmine.createSpy('commit').and.resolveTo(undefined),
    };
    const afs = {
      firestore: {
        doc: jasmine.createSpy('doc').and.callFake(doc),
        batch: jasmine.createSpy('batch').and.returnValue(batch),
      },
    };
    const service = new DataService(
      afs as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-8-2026',
        todaysDate: () => '8-7-2026',
      } as any,
      {} as any,
      {} as any
    );
    const attachment = {
      url: 'https://firebase.test/presence',
      path: 'attendance_proofs/site/employee/2026-08-07/123.jpeg',
      size: 12345,
      contentType: 'image/jpeg',
      uploadedAt: 1786099353292,
      uploaderId: 'site',
      takenAt: 1786099350000,
    };

    await service.finalizeAttendanceWithAttachment(
      'site',
      'employee',
      '2026-08-07',
      'L',
      '8-7-2026-12-9-19',
      'site',
      attachment
    );

    expect(afs.firestore.batch).toHaveBeenCalledTimes(1);
    expect(batch.set).toHaveBeenCalledTimes(3);
    expect(batch.set).toHaveBeenCalledWith(
      doc('users/site/employees/employee'),
      {
        attendance: { '8-7-2026-12-9-19': 'L' },
        attendanceAttachments: {
          '8-7-2026-12-9-19': attachment,
        },
      },
      { merge: true }
    );
    expect(batch.set).toHaveBeenCalledWith(
      doc('users/site/employees/employee/attendance/2026-08-07'),
      jasmine.objectContaining({
        status: 'L',
        proofState: 'ready',
        proof: attachment,
        attachmentId: '123_jpeg',
      }),
      { merge: true }
    );
    expect(batch.set).toHaveBeenCalledWith(
      doc(
        'users/site/employees/employee/attendance/2026-08-07/attachments/123_jpeg'
      ),
      attachment,
      { merge: true }
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('retries an atomic attendance commit without creating partial writes', async () => {
    const firstBatch = {
      set: jasmine.createSpy('firstSet'),
      commit: jasmine
        .createSpy('firstCommit')
        .and.rejectWith({ code: 'firestore/unavailable' }),
    };
    const secondBatch = {
      set: jasmine.createSpy('secondSet'),
      commit: jasmine.createSpy('secondCommit').and.resolveTo(undefined),
    };
    const afs = {
      firestore: {
        doc: (path: string) => ({ path }),
        batch: jasmine
          .createSpy('batch')
          .and.returnValues(firstBatch, secondBatch),
      },
    };
    const service = new DataService(
      afs as any,
      {} as any,
      {} as any,
      {
        getTomorrowsDateMonthDayYear: () => '8-8-2026',
        todaysDate: () => '8-7-2026',
      } as any,
      {} as any,
      {} as any
    );

    await service.finalizeAttendanceWithAttachment(
      'site',
      'employee',
      '2026-08-07',
      'P',
      '8-7-2026-8-0-0',
      'site',
      {
        url: 'https://firebase.test/presence',
        path: 'attendance_proofs/site/employee/2026-08-07/456.jpg',
        size: 100,
        contentType: 'image/jpeg',
        uploadedAt: 1786099353292,
        uploaderId: 'site',
      },
      [0]
    );

    expect(afs.firestore.batch).toHaveBeenCalledTimes(2);
    expect(firstBatch.commit).toHaveBeenCalledTimes(1);
    expect(secondBatch.commit).toHaveBeenCalledTimes(1);
    expect(firstBatch.set).toHaveBeenCalledTimes(3);
    expect(secondBatch.set).toHaveBeenCalledTimes(3);
  });
});
