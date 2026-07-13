import {
  buildClientPhotoDownloadUrl,
  createClientPhotoDownloadToken,
  describeClientPhotoUploadError,
  isClientPhoto,
  isHeicClientPhoto,
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

  it('builds a private Firebase media URL from a client-generated token', () => {
    const token = createClientPhotoDownloadToken();
    const url = buildClientPhotoDownloadUrl(
      'kank-test.appspot.com',
      'clients-home/Marie Kanku/photo.png',
      token
    );

    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(url).toContain('clients-home%2FMarie%20Kanku%2Fphoto.png');
    expect(url).toContain(`token=${token}`);
  });
});
