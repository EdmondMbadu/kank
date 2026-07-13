import { of, throwError } from 'rxjs';
import {
  isUnknownStorageError,
  recoverOrRetryClientPhotoUpload,
  recoverClientPhotoUpload,
  uploadClientPhotoThroughServer,
} from './client-photo-recovery.util';

describe('client photo recovery', () => {
  it('does not call the backend for an ordinary upload error', async () => {
    const functions = {
      httpsCallable: jasmine.createSpy('httpsCallable'),
    } as any;

    const recovered = await recoverClientPhotoUpload(
      functions,
      { code: 'storage/unauthorized' },
      'clients-home/photo.jpg'
    );

    expect(recovered).toBeNull();
    expect(functions.httpsCallable).not.toHaveBeenCalled();
  });

  it('recovers the real server URL after storage/unknown', async () => {
    const callable = jasmine.createSpy('callable').and.returnValue(
      of({
        exists: true,
        downloadURL: 'https://firebase.test/real-token',
        size: '63812',
      })
    );
    const functions = {
      httpsCallable: jasmine
        .createSpy('httpsCallable')
        .and.returnValue(callable),
    } as any;

    const recovered = await recoverClientPhotoUpload(
      functions,
      { code: 'storage/unknown' },
      'clients-home/photo.jpg'
    );

    expect(isUnknownStorageError({ code: 'storage/unknown' })).toBeTrue();
    expect(functions.httpsCallable).toHaveBeenCalledWith(
      'recoverClientPhotoUpload'
    );
    expect(callable).toHaveBeenCalledWith(
      jasmine.objectContaining({
        path: 'clients-home/photo.jpg',
        uploadError: jasmine.objectContaining({
          code: 'storage/unknown',
        }),
      })
    );
    expect(recovered).toEqual({
      downloadURL: 'https://firebase.test/real-token',
      size: '63812',
    });
  });

  it('keeps a genuine missing upload as a failure', async () => {
    const functions = {
      httpsCallable: jasmine.createSpy('httpsCallable').and.returnValue(() =>
        of({ exists: false })
      ),
    } as any;

    const recovered = await recoverClientPhotoUpload(
      functions,
      { code: 'storage/unknown' },
      'clients-avatar/photo.jpg'
    );

    expect(recovered).toBeNull();
  });

  it('returns a normal failure when the recovery service is unavailable', async () => {
    const functions = {
      httpsCallable: jasmine.createSpy('httpsCallable').and.returnValue(() =>
        throwError(() => new Error('offline'))
      ),
    } as any;
    spyOn(console, 'error');

    const recovered = await recoverClientPhotoUpload(
      functions,
      { code: 'storage/unknown' },
      'clients-home/photo.jpg'
    );

    expect(recovered).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('uses a one-shot upload when the resumable object is genuinely missing', async () => {
    const callable = jasmine
      .createSpy('callable')
      .and.returnValue(of({ exists: false }));
    const functions = {
      httpsCallable: jasmine
        .createSpy('httpsCallable')
        .and.returnValue(callable),
    } as any;
    const file = new File(['iphone-photo'], 'photo.jpg', {
      type: 'image/jpeg',
    });
    const oneShotUploader = jasmine
      .createSpy('oneShotUploader')
      .and.resolveTo({
        downloadURL: 'https://firebase.test/one-shot-photo',
        size: String(file.size),
      });

    const recovered = await recoverOrRetryClientPhotoUpload(
      functions,
      {} as any,
      {
        code: 'storage/unknown',
        status_: 400,
        customData: { serverResponse: '' },
      },
      'clients-home/photo.jpg',
      file,
      oneShotUploader
    );

    expect(oneShotUploader).toHaveBeenCalledWith(
      jasmine.anything(),
      'clients-home/photo.jpg',
      file
    );
    expect(recovered).toEqual({
      downloadURL: 'https://firebase.test/one-shot-photo',
      size: String(file.size),
    });
    const request = callable.calls.mostRecent().args[0];
    expect(request.uploadError).toEqual({
      code: 'storage/unknown',
      serverResponse: '',
      status: '400',
    });
  });

  it('does not use the one-shot fallback for a specific Storage error', async () => {
    const functions = {
      httpsCallable: jasmine.createSpy('httpsCallable'),
    } as any;
    const oneShotUploader = jasmine.createSpy('oneShotUploader');

    const recovered = await recoverOrRetryClientPhotoUpload(
      functions,
      {} as any,
      { code: 'storage/unauthorized' },
      'clients-avatar/photo.jpg',
      new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
      oneShotUploader
    );

    expect(recovered).toBeNull();
    expect(oneShotUploader).not.toHaveBeenCalled();
    expect(functions.httpsCallable).not.toHaveBeenCalled();
  });

  it('uploads through the callable channel when both Storage protocols fail', async () => {
    const callable = jasmine
      .createSpy('callable')
      .and.returnValue(of({ exists: false }));
    const functions = {
      httpsCallable: jasmine
        .createSpy('httpsCallable')
        .and.returnValue(callable),
    } as any;
    const oneShotUploader = jasmine
      .createSpy('oneShotUploader')
      .and.rejectWith({ code: 'storage/unknown' });
    const serverUploader = jasmine
      .createSpy('serverUploader')
      .and.resolveTo({
        downloadURL: 'https://firebase.test/server-photo',
        size: '2048',
      });
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    spyOn(console, 'error');

    const recovered = await recoverOrRetryClientPhotoUpload(
      functions,
      {} as any,
      { code: 'storage/unknown' },
      'clients-home/photo.jpg',
      file,
      oneShotUploader,
      serverUploader
    );

    expect(serverUploader).toHaveBeenCalledWith(
      functions,
      'clients-home/photo.jpg',
      file
    );
    expect(recovered).toEqual({
      downloadURL: 'https://firebase.test/server-photo',
      size: '2048',
    });
  });

  it('sends exact image bytes and metadata through the server fallback', async () => {
    const callable = jasmine.createSpy('callable').and.returnValue(
      of({
        downloadURL: 'https://firebase.test/server-photo',
        size: '5',
      })
    );
    const functions = {
      httpsCallable: jasmine
        .createSpy('httpsCallable')
        .and.returnValue(callable),
    } as any;

    const uploaded = await uploadClientPhotoThroughServer(
      functions,
      'clients-avatar/photo.jpg',
      new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    );

    expect(functions.httpsCallable).toHaveBeenCalledWith(
      'uploadClientPhotoFallback'
    );
    expect(callable).toHaveBeenCalledWith({
      path: 'clients-avatar/photo.jpg',
      contentType: 'image/jpeg',
      contentBase64: btoa('photo'),
    });
    expect(uploaded.downloadURL).toBe(
      'https://firebase.test/server-photo'
    );
  });

  it('checks Storage once more when every upload response fails', async () => {
    const callable = jasmine
      .createSpy('callable')
      .and.returnValues(
        of({ exists: false }),
        of({
          exists: true,
          downloadURL: 'https://firebase.test/committed-one-shot',
          size: '2048',
        })
      );
    const functions = {
      httpsCallable: jasmine
        .createSpy('httpsCallable')
        .and.returnValue(callable),
    } as any;
    const oneShotUploader = jasmine
      .createSpy('oneShotUploader')
      .and.rejectWith({ code: 'storage/unknown' });
    const serverUploader = jasmine
      .createSpy('serverUploader')
      .and.rejectWith(new Error('callable transport failed'));
    spyOn(console, 'error');

    const recovered = await recoverOrRetryClientPhotoUpload(
      functions,
      {} as any,
      { code: 'storage/unknown' },
      'clients-home/photo.jpg',
      new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
      oneShotUploader,
      serverUploader
    );

    expect(callable).toHaveBeenCalledTimes(2);
    expect(recovered).toEqual({
      downloadURL: 'https://firebase.test/committed-one-shot',
      size: '2048',
    });
  });
});
