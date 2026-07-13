import {
  describeClientPhotoUploadError,
  isClientPhoto,
  isHeicClientPhoto,
  uploadClientPhoto,
} from './client-photo-upload.util';

describe('client photo upload utilities', () => {
  it('accepts normal browser image MIME types', () => {
    const photo = new File(['photo'], 'maison.jpg', { type: 'image/jpeg' });

    expect(isClientPhoto(photo)).toBeTrue();
  });

  it('accepts a mobile image filename when the browser omits its MIME type', () => {
    const photo = new File(['photo'], 'IMG_1234.HEIC');

    expect(isClientPhoto(photo)).toBeTrue();
    expect(isHeicClientPhoto(photo)).toBeTrue();
  });

  it('accepts HEIF sequence MIME types reported by mobile photo pickers', () => {
    const photo = new File(['photo'], 'IMG_1234', {
      type: 'image/heif-sequence',
    });

    expect(isClientPhoto(photo)).toBeTrue();
    expect(isHeicClientPhoto(photo)).toBeTrue();
  });

  it('rejects a non-image file with no MIME type', () => {
    const document = new File(['text'], 'notes.txt');

    expect(isClientPhoto(document)).toBeFalse();
  });

  it('exposes an authentication failure with an actionable message', () => {
    const result = describeClientPhotoUploadError({
      code: 'storage/unauthenticated',
    }, 'envoi');

    expect(result.code).toBe('storage/unauthenticated');
    expect(result.message).toContain('session');
    expect(result.stage).toBe('envoi');
  });

  it('uses the ordinary upload endpoint and Firebase server download URL', async () => {
    const file = new File(['phone-photo'], 'maison.png', {
      type: 'image/png',
    });
    const delegate = {} as any;
    const uploadedReference = {} as any;
    const storage = {
      storage: {
        ref: jasmine.createSpy('ref').and.returnValue({ _delegate: delegate }),
      },
    } as any;
    const operations = {
      uploadBytes: jasmine.createSpy('uploadBytes').and.resolveTo({
        metadata: { size: file.size },
        ref: uploadedReference,
      }),
      getDownloadURL: jasmine
        .createSpy('getDownloadURL')
        .and.resolveTo('https://firebase.test/real-server-token'),
    } as any;

    const uploaded = await uploadClientPhoto(
      storage,
      'clients-home/photo.png',
      file,
      operations
    );

    expect(storage.storage.ref).toHaveBeenCalledWith(
      'clients-home/photo.png'
    );
    expect(operations.uploadBytes).toHaveBeenCalledWith(delegate, file, {
      contentType: 'image/png',
    });
    expect(operations.getDownloadURL).toHaveBeenCalledWith(uploadedReference);
    expect(uploaded).toEqual({
      downloadURL: 'https://firebase.test/real-server-token',
      size: String(file.size),
    });
  });
});
