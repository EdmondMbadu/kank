import type { AngularFireStorage } from '@angular/fire/compat/storage';
import { uploadBytes } from 'firebase/storage';
import type { StorageReference, UploadMetadata } from 'firebase/storage';

export interface AuditAudioUploadResult {
  ref: { getDownloadURL(): Promise<string> };
}

/** Retry a failed resumable transfer with one multipart request to the same object. */
export async function uploadAuditAudioBytes(
  storage: AngularFireStorage,
  path: string,
  file: File,
  metadata: UploadMetadata,
  sendBytes = uploadBytes
): Promise<AuditAudioUploadResult> {
  // Materialize mobile/iCloud-backed files before handing the payload to XHR.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytes.length || bytes.length !== file.size) {
    throw { code: 'storage/cannot-slice-blob', message: 'The audio file could not be read completely.' };
  }
  const reference = storage.storage.ref(path);
  const delegate = (reference as unknown as { _delegate: StorageReference })._delegate;
  await sendBytes(delegate, bytes, metadata);
  return { ref: reference };
}
