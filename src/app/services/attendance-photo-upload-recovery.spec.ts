import { of } from 'rxjs';
import { DataService } from './data.service';

describe('attendance attachment upload recovery', () => {
  const file = new File(['attendance-photo'], 'presence.jpg', {
    type: 'image/jpeg',
  });

  function createService(storage: any): DataService {
    const time = {
      getTomorrowsDateMonthDayYear: () => '7-24-2026',
      todaysDate: () => '7-23-2026-12-00-00',
    };
    return new DataService(
      {} as any,
      storage,
      {} as any,
      time as any,
      {} as any,
      {} as any
    );
  }

  it('keeps the existing successful attendance upload path unchanged', async () => {
    const storage = {
      upload: jasmine.createSpy('upload').and.resolveTo({
        ref: {
          getDownloadURL: () =>
            Promise.resolve('https://firebase.test/attendance-photo'),
        },
      }),
    };
    const functions = {
      httpsCallable: jasmine.createSpy('httpsCallable'),
    } as any;

    const attachment = await createService(storage).uploadAttendanceAttachment(
      file,
      'employee-1',
      'user-1',
      '2026-07-24',
      'user-1',
      '7-24-2026-08-30-00',
      functions
    );

    expect(attachment.url).toBe(
      'https://firebase.test/attendance-photo'
    );
    expect(storage.upload).toHaveBeenCalled();
    expect(functions.httpsCallable).not.toHaveBeenCalled();
  });

  it('recovers a committed attendance photo after storage/unknown', async () => {
    const storage = {
      upload: jasmine
        .createSpy('upload')
        .and.rejectWith({ code: 'storage/unknown', status_: 400 }),
    };
    const callable = jasmine.createSpy('callable').and.returnValue(
      of({
        exists: true,
        downloadURL: 'https://firebase.test/recovered-attendance-photo',
        size: String(file.size),
      })
    );
    const functions = {
      httpsCallable: jasmine
        .createSpy('httpsCallable')
        .and.returnValue(callable),
    } as any;

    const attachment = await createService(storage).uploadAttendanceAttachment(
      file,
      'employee-1',
      'user-1',
      '2026-07-23',
      'user-1',
      '7-23-2026-08-30-00',
      functions
    );

    expect(functions.httpsCallable).toHaveBeenCalledWith(
      'recoverClientPhotoUpload'
    );
    expect(callable).toHaveBeenCalledWith(
      jasmine.objectContaining({
        path: jasmine.stringMatching(
          /^attendance_proofs\/user-1\/employee-1\/2026-07-23\//
        ),
      })
    );
    expect(attachment.url).toBe(
      'https://firebase.test/recovered-attendance-photo'
    );
  });
});
