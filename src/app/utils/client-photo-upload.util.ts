export const MAX_CLIENT_PHOTO_BYTES = 20_000_000;

const IMAGE_FILE_EXTENSION =
  /\.(avif|bmp|gif|heic|heif|jfif|jpe?g|png|svg|tiff?|webp)$/i;
const HEIC_FILE_EXTENSION = /\.(heic|heif)$/i;

/**
 * Mobile browsers do not always provide a MIME type for camera/gallery files.
 * Accept a known image extension when the MIME type is empty or generic.
 */
export function isClientPhoto(file: File): boolean {
  const mimeType = (file.type || '').trim().toLowerCase();

  if (mimeType.startsWith('image/')) {
    return true;
  }

  return (
    (!mimeType || mimeType === 'application/octet-stream') &&
    IMAGE_FILE_EXTENSION.test(file.name || '')
  );
}

export function isHeicClientPhoto(file: File): boolean {
  const mimeType = (file.type || '').trim().toLowerCase();
  return (
    /^image\/hei[cf](?:-sequence)?$/.test(mimeType) ||
    HEIC_FILE_EXTENSION.test(file.name || '')
  );
}

/**
 * Convert iPhone HEIC/HEIF photos to JPEG so Firebase metadata and previews
 * behave consistently across iOS, Android, and desktop browsers.
 */
export async function prepareClientPhotoForUpload(file: File): Promise<File> {
  if (!isHeicClientPhoto(file)) {
    return file;
  }

  try {
    const heic2any = (await import('heic2any')).default;
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    });
    const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
    const originalName = file.name || 'photo-maison.heic';
    const jpegName = originalName.replace(/\.(heic|heif)$/i, '') + '.jpg';

    return new File([convertedBlob], jpegName, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch (error) {
    // Some Safari versions already handle HEIC but cannot run heic2any.
    // Uploading the original still lets registration finish on those phones.
    console.warn('HEIC conversion unavailable; uploading original photo.', error);
    return file;
  }
}
