import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { firstValueFrom } from 'rxjs';

export interface RecoveredClientPhoto {
  downloadURL: string;
  size: string;
}

interface ClientPhotoRecoveryResponse {
  downloadURL?: unknown;
  exists?: unknown;
  size?: unknown;
}

export function isUnknownStorageError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'storage/unknown';
}

/**
 * Firebase can commit an iPhone upload and still reject the resumable task's
 * final response. Ask the trusted backend for the real server token only for
 * that exact ambiguous error. Normal uploads never call this fallback.
 */
export async function recoverClientPhotoUpload(
  functions: AngularFireFunctions,
  error: unknown,
  path: string
): Promise<RecoveredClientPhoto | null> {
  if (!isUnknownStorageError(error)) {
    return null;
  }

  try {
    const callable = functions.httpsCallable<
      { path: string },
      ClientPhotoRecoveryResponse
    >('recoverClientPhotoUpload');
    const response = await firstValueFrom(callable({ path }));

    if (
      response?.exists !== true ||
      typeof response.downloadURL !== 'string' ||
      !response.downloadURL
    ) {
      return null;
    }

    return {
      downloadURL: response.downloadURL,
      size: String(response.size || '0'),
    };
  } catch (recoveryError) {
    console.error('Client photo recovery failed:', recoveryError);
    return null;
  }
}
