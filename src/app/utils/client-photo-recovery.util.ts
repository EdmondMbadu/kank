import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { getDownloadURL, uploadBytes } from 'firebase/storage';
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

interface ClientPhotoFallbackResponse {
  downloadURL?: unknown;
  size?: unknown;
}

interface StorageErrorDiagnostics {
  code: string;
  serverResponse: string;
  status: string;
}

export type ClientPhotoOneShotUploader = (
  storage: AngularFireStorage,
  path: string,
  file: File
) => Promise<RecoveredClientPhoto>;

export type ClientPhotoServerUploader = (
  functions: AngularFireFunctions,
  path: string,
  file: File
) => Promise<RecoveredClientPhoto>;

export function isUnknownStorageError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'storage/unknown';
}

function storageErrorDiagnostics(error: unknown): StorageErrorDiagnostics {
  const value = (error || {}) as {
    code?: unknown;
    customData?: { serverResponse?: unknown };
    serverResponse?: unknown;
    status?: unknown;
    status_?: unknown;
  };
  const serverResponse =
    value.customData?.serverResponse ?? value.serverResponse ?? '';

  return {
    code: String(value.code || '').slice(0, 100),
    serverResponse: String(serverResponse || '').slice(0, 1000),
    status: String(value.status ?? value.status_ ?? '').slice(0, 20),
  };
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
      { path: string; uploadError: StorageErrorDiagnostics },
      ClientPhotoRecoveryResponse
    >('recoverClientPhotoUpload');
    const response = await firstValueFrom(
      callable({ path, uploadError: storageErrorDiagnostics(error) })
    );

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

/**
 * Uses Firebase's one-request multipart uploader instead of the resumable
 * transport used by AngularFireStorage.upload(). The compat reference keeps
 * the existing signed-in Firebase app; uploadBytes only changes the wire
 * protocol used for this retry.
 */
export async function uploadClientPhotoOneShot(
  storage: AngularFireStorage,
  path: string,
  file: File
): Promise<RecoveredClientPhoto> {
  const compatReference = storage.storage.ref(path) as unknown as {
    _delegate?: unknown;
  };

  if (!compatReference._delegate) {
    throw new Error('Firebase Storage reference is unavailable.');
  }

  const result = await uploadBytes(compatReference._delegate as any, file, {
    contentType: file.type || 'application/octet-stream',
  });
  const downloadURL = await getDownloadURL(result.ref);

  return {
    downloadURL,
    size: String(result.metadata.size || file.size || 0),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
    );
  }

  return btoa(chunks.join(''));
}

/**
 * Final mobile fallback. The callable channel is already authenticated and
 * working on affected iPhones, so send the image bytes through it and let the
 * trusted backend write to Storage without using iOS's failing Storage XHR.
 */
export async function uploadClientPhotoThroughServer(
  functions: AngularFireFunctions,
  path: string,
  file: File
): Promise<RecoveredClientPhoto> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const callable = functions.httpsCallable<
    { path: string; contentType: string; contentBase64: string },
    ClientPhotoFallbackResponse
  >('uploadClientPhotoFallback');
  const response = await firstValueFrom(
    callable({
      path,
      contentType: file.type || 'application/octet-stream',
      contentBase64: bytesToBase64(bytes),
    })
  );

  if (
    typeof response?.downloadURL !== 'string' ||
    !response.downloadURL
  ) {
    throw new Error('The photo fallback returned no download URL.');
  }

  return {
    downloadURL: response.downloadURL,
    size: String(response.size || file.size || 0),
  };
}

/**
 * Resolve an ambiguous completed upload first. If the server confirms that no
 * object exists, retry the same file with Firebase's non-resumable uploader.
 * A final server check also covers the unlikely case where that retry commits
 * the object but its response is lost.
 */
export async function recoverOrRetryClientPhotoUpload(
  functions: AngularFireFunctions,
  storage: AngularFireStorage,
  error: unknown,
  path: string,
  file: File,
  oneShotUploader: ClientPhotoOneShotUploader = uploadClientPhotoOneShot,
  serverUploader: ClientPhotoServerUploader = uploadClientPhotoThroughServer
): Promise<RecoveredClientPhoto | null> {
  if (!isUnknownStorageError(error)) {
    return null;
  }

  const alreadyUploaded = await recoverClientPhotoUpload(
    functions,
    error,
    path
  );
  if (alreadyUploaded) {
    return alreadyUploaded;
  }

  try {
    return await oneShotUploader(storage, path, file);
  } catch (oneShotError) {
    console.error('Client photo one-shot upload failed:', oneShotError);
  }

  try {
    return await serverUploader(functions, path, file);
  } catch (serverUploadError) {
    console.error('Client photo server upload failed:', serverUploadError);
    return recoverClientPhotoUpload(functions, error, path);
  }
}
