import {
  isClientPhoto,
  isHeicClientPhoto,
  prepareClientPhotoForUpload,
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

  it('leaves a normal image unchanged', async () => {
    const photo = new File(['photo'], 'maison.webp', { type: 'image/webp' });

    expect(await prepareClientPhotoForUpload(photo)).toBe(photo);
  });
});
