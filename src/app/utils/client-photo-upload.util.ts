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

export interface ClientPhotoUploadError {
  code: string;
  detail: string;
  message: string;
  stage: string;
}

/** Return a useful phone-visible error instead of hiding Firebase's error code. */
export function describeClientPhotoUploadError(
  error: unknown,
  stage: string
): ClientPhotoUploadError {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code =
    typeof candidate?.code === 'string' ? candidate.code : 'storage/unknown';
  const detail =
    typeof candidate?.message === 'string' && candidate.message.trim()
      ? candidate.message.trim()
      : String(error);

  const messages: Record<string, string> = {
    'storage/unauthenticated':
      'Votre session a expiré. Reconnectez-vous, puis réessayez.',
    'storage/unauthorized':
      "Votre session n'autorise pas ce chargement. Reconnectez-vous, puis réessayez.",
    'storage/retry-limit-exceeded':
      'La connexion est trop lente ou instable. Vérifiez Internet, puis réessayez.',
    'storage/quota-exceeded':
      "L'espace de stockage Firebase n'est pas disponible actuellement.",
    'storage/canceled': 'Le chargement de la photo a été annulé.',
    'auth/network-request-failed':
      'Impossible de vérifier votre session à cause de la connexion Internet.',
  };

  return {
    code,
    detail,
    message:
      messages[code] ||
      "Une erreur technique a interrompu le chargement de la photo.",
    stage,
  };
}
