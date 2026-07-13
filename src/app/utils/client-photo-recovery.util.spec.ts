import { of, throwError } from 'rxjs';
import {
  isUnknownStorageError,
  recoverClientPhotoUpload,
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
    expect(callable).toHaveBeenCalledWith({ path: 'clients-home/photo.jpg' });
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
});
