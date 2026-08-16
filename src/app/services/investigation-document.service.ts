import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, firstValueFrom, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import {
  InvestigationDocument,
  InvestigationDocumentVersion,
} from '../models/investigation-document';
import {
  cleanInvestigationDocumentFileName,
  investigationPdfValidationError,
  mergeInvestigationDocuments,
} from '../utils/investigation-document.util';

export interface InvestigationDocumentEditorIdentity {
  uid?: string;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class InvestigationDocumentService {
  readonly documents$: Observable<InvestigationDocument[]> = this.afs
    .collection<InvestigationDocument>('investigationDocuments')
    .valueChanges({ idField: 'id' })
    .pipe(
      map(mergeInvestigationDocuments),
      catchError(() => of(mergeInvestigationDocuments([]))),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  constructor(
    private afs: AngularFirestore,
    private storage: AngularFireStorage
  ) {}

  async addDocument(
    file: File,
    title: string,
    description: string,
    identity: InvestigationDocumentEditorIdentity,
    sortOrder: number
  ): Promise<void> {
    this.assertValid(file, title);
    const id = this.afs.createId();
    const now = new Date().toISOString();
    const uploaded = await this.upload(id, 1, file);
    const document: InvestigationDocument = {
      id,
      title: title.trim(),
      description: description.trim(),
      fileName: file.name,
      mimeType: 'application/pdf',
      size: file.size,
      sortOrder,
      active: true,
      source: 'uploaded',
      version: 1,
      downloadURL: uploaded.downloadURL,
      storagePath: uploaded.storagePath,
      uploadedAt: now,
      updatedAt: now,
      uploadedBy: identity.uid || '',
      uploadedByName: identity.name || '',
      versions: [],
    };

    try {
      await this.documentRef(id).set(this.payload(document));
    } catch (error) {
      await this.deleteUploadedFile(uploaded.storagePath);
      throw error;
    }
  }

  async replaceDocument(
    current: InvestigationDocument,
    file: File,
    title: string,
    description: string,
    identity: InvestigationDocumentEditorIdentity
  ): Promise<void> {
    this.assertValid(file, title);
    const nextVersion = Math.max(1, current.version || 1) + 1;
    const now = new Date().toISOString();
    const uploaded = await this.upload(current.id, nextVersion, file);
    const history = [...(current.versions || []), this.versionSnapshot(current)].slice(-20);
    const document: InvestigationDocument = {
      ...current,
      title: title.trim(),
      description: description.trim(),
      fileName: file.name,
      mimeType: 'application/pdf',
      size: file.size,
      active: true,
      source: 'uploaded',
      version: nextVersion,
      downloadURL: uploaded.downloadURL,
      storagePath: uploaded.storagePath,
      uploadedAt: now,
      updatedAt: now,
      uploadedBy: identity.uid || '',
      uploadedByName: identity.name || '',
      versions: history,
    };

    try {
      await this.documentRef(current.id).set(this.payload(document));
    } catch (error) {
      await this.deleteUploadedFile(uploaded.storagePath);
      throw error;
    }
  }

  archiveDocument(document: InvestigationDocument): Promise<void> {
    return this.documentRef(document.id).set(
      this.payload({
        ...document,
        active: false,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  restoreDocument(document: InvestigationDocument): Promise<void> {
    return this.documentRef(document.id).set(
      this.payload({
        ...document,
        active: true,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  private documentRef(id: string) {
    return this.afs.doc<InvestigationDocument>(`investigationDocuments/${id}`);
  }

  private assertValid(file: File, title: string): void {
    const fileError = investigationPdfValidationError(file);
    if (fileError) throw new Error(fileError);
    if (!title.trim()) throw new Error('Indiquez un titre pour le document.');
  }

  private async upload(id: string, version: number, file: File) {
    const storagePath = `investigation-documents/${id}/v${version}-${cleanInvestigationDocumentFileName(
      file.name
    )}`;
    const uploadTask = await this.storage.upload(storagePath, file, {
      contentType: 'application/pdf',
      customMetadata: { documentId: id, version: String(version) },
    });
    const downloadURL = await uploadTask.ref.getDownloadURL();
    return { storagePath, downloadURL };
  }

  private versionSnapshot(
    document: InvestigationDocument
  ): InvestigationDocumentVersion {
    return this.removeUndefined({
      version: document.version,
      fileName: document.fileName,
      assetUrl: document.assetUrl,
      downloadURL: document.downloadURL,
      storagePath: document.storagePath,
      uploadedAt: document.uploadedAt,
      uploadedBy: document.uploadedBy,
      uploadedByName: document.uploadedByName,
    });
  }

  private payload(document: InvestigationDocument): InvestigationDocument {
    return this.removeUndefined(document);
  }

  private removeUndefined<T extends object>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined)
    ) as T;
  }

  private async deleteUploadedFile(path: string): Promise<void> {
    try {
      await firstValueFrom(this.storage.ref(path).delete());
    } catch {
      // Rollback cleanup is best-effort; the metadata write error remains authoritative.
    }
  }
}
