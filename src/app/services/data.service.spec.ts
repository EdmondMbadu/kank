import { DataService } from './data.service';

describe('DataService', () => {
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
});
