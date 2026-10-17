import { of, throwError } from 'rxjs';
import { DataService, InvestigationMediaLogContext } from './data.service';

describe('investigation feedback media diagnostics', () => {
  const context: InvestigationMediaLogContext = {
    ownerId: 'site-1', clientId: 'client-1', dayKey: '10-17-2026',
    investigatorId: 'employee-1', verifierName: 'Investigator',
  };
  const file = new File(['audio'], 'recording.m4a', { type: 'audio/mp4' });

  function setup() {
    const add = jasmine.createSpy('add').and.resolveTo({ id: 'diagnostic-1' });
    const collection = jasmine.createSpy('collection').and.returnValue({ add });
    const getDownloadURL = jasmine.createSpy('getDownloadURL')
      .and.returnValue(of('https://example.test/audio'));
    const storage = {
      ref: jasmine.createSpy('ref').and.returnValue({ getDownloadURL }),
      upload: jasmine.createSpy('upload').and.resolveTo(undefined),
    };
    const service = new DataService(
      { collection } as any, storage as any,
      { currentUser: { uid: 'signed-in-site' } } as any,
      {
        getTomorrowsDateMonthDayYear: () => '10-18-2026',
        todaysDate: () => '10-17-2026-10-0-0',
      } as any, {} as any, {} as any
    );
    spyOn(console, 'error');
    return { service, storage, getDownloadURL, collection, add };
  }

  it('does not add writes or change the normal upload result', async () => {
    const { service, storage, add } = setup();
    expect(await service.uploadCommentFile(file, 'feedback/path', context))
      .toBe('https://example.test/audio');
    expect(storage.upload).toHaveBeenCalledOnceWith('feedback/path', file);
    expect(add).not.toHaveBeenCalled();
  });

  it('records the failing upload stage with investigator and file metadata', async () => {
    const { service, storage, collection, add } = setup();
    const original = { code: 'storage/retry-limit-exceeded', message: 'Timed out' };
    storage.upload.and.rejectWith(original);
    await expectAsync(service.uploadCommentFile(file, 'feedback/path', context))
      .toBeRejectedWith(original);
    expect(collection).toHaveBeenCalledOnceWith('investigationMediaErrors');
    expect(add).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      stage: 'upload', errorCode: original.code, actorUid: 'signed-in-site',
      investigatorId: 'employee-1', ownerId: 'site-1', clientId: 'client-1',
      dayKey: '10-17-2026', fileType: 'audio/mp4', fileSize: 5,
      fileExtension: 'm4a', diagnosticsVersion: '2026-10-17-v1',
      createdAt: jasmine.anything(), userAgent: navigator.userAgent,
    }));
  });

  it('distinguishes a completed upload whose download URL cannot be retrieved', async () => {
    const { service, getDownloadURL, add } = setup();
    const original = { code: 'storage/unauthorized' };
    getDownloadURL.and.returnValue(throwError(() => original));
    await expectAsync(service.uploadCommentFile(file, 'feedback/path', context))
      .toBeRejectedWith(original);
    expect(add.calls.mostRecent().args[0].stage).toBe('download-url');
  });

  it('also records synchronous Storage errors without changing how they are thrown', () => {
    const { service, storage, add } = setup();
    const original = new Error('File is unavailable');
    storage.upload.and.callFake(() => { throw original; });
    expect(() => service.uploadCommentFile(file, 'feedback/path', context)).toThrow(original);
    expect(add.calls.mostRecent().args[0].stage).toBe('upload');
  });

  it('never waits for diagnostics before returning the original upload failure', async () => {
    const { service, storage, add } = setup();
    const original = { code: 'storage/unknown' };
    add.and.returnValue(new Promise(() => {}));
    storage.upload.and.rejectWith(original);
    await expectAsync(service.uploadCommentFile(file, 'feedback/path', context))
      .toBeRejectedWith(original);
  });

  it('preserves the upload failure even when logging is denied', async () => {
    const { service, storage, add } = setup();
    const original = { code: 'storage/unknown' };
    add.and.rejectWith(new Error('permission-denied'));
    storage.upload.and.rejectWith(original);
    await expectAsync(service.uploadCommentFile(file, 'feedback/path', context))
      .toBeRejectedWith(original);
    expect(console.error).toHaveBeenCalledWith(
      'Feedback media error log could not be saved:', jasmine.any(Error)
    );
  });

  it('preserves the upload failure even when the logging SDK throws synchronously', async () => {
    const { service, storage, collection } = setup();
    const original = { code: 'storage/unknown' };
    collection.and.throwError('SDK unavailable');
    storage.upload.and.rejectWith(original);
    await expectAsync(service.uploadCommentFile(file, 'feedback/path', context))
      .toBeRejectedWith(original);
  });

  it('removes credentials and download URLs and never includes file contents', () => {
    const { service, add } = setup();
    service.logInvestigationMediaError({
      code: 'storage/unknown',
      message: 'Could not read https://example.test/audio?token=secret-download-token',
      serverResponse: '{"error":{"message":"denied","token":"secret-token","authorization":"Bearer secret-bearer"}}',
    }, context, 'upload', file);
    const record = add.calls.mostRecent().args[0];
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('secret-');
    expect(record.errorMessage).toContain('[URL removed]');
    expect(record.serverResponse).toContain('denied');
    expect(record.file).toBeUndefined();
    expect(record.fileName).toBeUndefined();
  });
});
