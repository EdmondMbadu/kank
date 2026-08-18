import {
  AttendanceImageCodec,
  ATTENDANCE_PHOTO_MAX_BYTES,
  prepareAttendancePhoto,
} from './attendance-photo-preparation.util';

describe('attendance photo preparation', () => {
  function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('no canvas blob'))),
        'image/jpeg',
        0.95
      )
    );
  }

  function codecFor(
    width: number,
    height: number,
    sizeFor: (width: number, height: number, quality: number) => number
  ) {
    const release = jasmine.createSpy('release');
    const encode = jasmine
      .createSpy('encode')
      .and.callFake(
        async (_source: CanvasImageSource, w: number, h: number, q: number) =>
          new Blob([new Uint8Array(sizeFor(w, h, q))], {
            type: 'image/jpeg',
          })
      );
    const fakeSource = {} as CanvasImageSource;
    const codec: AttendanceImageCodec = {
      decode: async () => ({
        source: fakeSource,
        width,
        height,
        release,
      }),
      encode,
    };
    return { codec, encode, release };
  }

  it('resizes a large phone photo and returns a bounded JPEG', async () => {
    const { codec, encode, release } = codecFor(
      4032,
      3024,
      (width, height, quality) => Math.round(width * height * quality * 0.2)
    );
    const original = new File([new Uint8Array(8_000_000)], 'IMG_1234.HEIC', {
      type: 'image/heic',
      lastModified: 1786099353292,
    });

    const result = await prepareAttendancePhoto(original, {}, codec);

    expect(result.width).toBeLessThanOrEqual(1440);
    expect(result.height).toBeLessThanOrEqual(1440);
    expect(result.uploadSize).toBeLessThanOrEqual(ATTENDANCE_PHOTO_MAX_BYTES);
    expect(result.file.name).toBe('IMG_1234-presence.jpg');
    expect(result.file.type).toBe('image/jpeg');
    expect(result.file.lastModified).toBe(original.lastModified);
    expect(encode).toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('reduces dimensions when quality alone cannot reach the target', async () => {
    const { codec, encode } = codecFor(
      3000,
      2000,
      (width, height) => Math.round(width * height * 0.35)
    );

    const result = await prepareAttendancePhoto(
      new File([new Uint8Array(5_000_000)], 'presence.png', {
        type: 'image/png',
      }),
      {},
      codec
    );

    const attemptedWidths = encode.calls.allArgs().map((args) => args[1]);
    expect(new Set(attemptedWidths).size).toBeGreaterThan(1);
    expect(result.uploadSize).toBeLessThanOrEqual(ATTENDANCE_PHOTO_MAX_BYTES);
  });

  it('always releases the decoded image after an encoding failure', async () => {
    const release = jasmine.createSpy('release');
    const codec: AttendanceImageCodec = {
      decode: async () => ({
        source: {} as CanvasImageSource,
        width: 1200,
        height: 900,
        release,
      }),
      encode: async () => {
        throw new Error('canvas failed');
      },
    };

    await expectAsync(
      prepareAttendancePhoto(
        new File(['photo'], 'presence.jpg', { type: 'image/jpeg' }),
        {},
        codec
      )
    ).toBeRejectedWithError('canvas failed');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('uses the real browser decoder and canvas encoder successfully', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2200;
    canvas.height = 1600;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 2200, 1600);
    gradient.addColorStop(0, '#173f5f');
    gradient.addColorStop(0.5, '#ed553b');
    gradient.addColorStop(1, '#3caea3');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#fff';
    context.font = 'bold 160px sans-serif';
    context.fillText('Présence', 480, 880);
    const source = await canvasBlob(canvas);
    const original = new File([source], 'camera-photo.jpg', {
      type: 'image/jpeg',
      lastModified: 1786099353292,
    });

    const result = await prepareAttendancePhoto(original);

    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(1440);
    expect(result.uploadSize).toBeLessThanOrEqual(ATTENDANCE_PHOTO_MAX_BYTES);
    expect(result.file.type).toBe('image/jpeg');
  });
});
