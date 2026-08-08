import {
  attendanceFileFingerprint,
  uploadFirstThenFinalizeAttendance,
} from './attendance-photo-finalization.util';

describe('attendance photo finalization', () => {
  it('uploads the photo before finalizing attendance', async () => {
    const order: string[] = [];
    const attachment = { path: 'attendance/photo.jpg' };

    const result = await uploadFirstThenFinalizeAttendance(
      async () => {
        order.push('upload');
        return attachment;
      },
      async (uploaded) => {
        expect(uploaded).toBe(attachment);
        order.push('finalize');
      }
    );

    expect(result).toBe(attachment);
    expect(order).toEqual(['upload', 'finalize']);
  });

  it('never finalizes attendance when the photo upload fails', async () => {
    const finalize = jasmine.createSpy('finalize');

    await expectAsync(
      uploadFirstThenFinalizeAttendance(
        async () => {
          throw new Error('offline');
        },
        finalize
      )
    ).toBeRejectedWithError('offline');

    expect(finalize).not.toHaveBeenCalled();
  });

  it('uses a stable fingerprint so a completed upload can be reused', () => {
    const file = new File(['photo'], 'presence.jpg', {
      type: 'image/jpeg',
      lastModified: 1786099353292,
    });

    expect(attendanceFileFingerprint(file)).toBe(
      'presence.jpg|5|1786099353292|image/jpeg'
    );
  });
});
