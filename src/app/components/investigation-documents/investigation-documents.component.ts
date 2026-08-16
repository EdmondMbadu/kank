import {
  Component,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { InvestigationDocument } from 'src/app/models/investigation-document';
import {
  InvestigationDocumentEditorIdentity,
  InvestigationDocumentService,
} from 'src/app/services/investigation-document.service';
import {
  investigationDocumentUrl,
  investigationPdfValidationError,
} from 'src/app/utils/investigation-document.util';

@Component({
  selector: 'app-investigation-documents',
  templateUrl: './investigation-documents.component.html',
  styleUrls: ['./investigation-documents.component.css'],
})
export class InvestigationDocumentsComponent implements OnInit, OnDestroy {
  @Input() canManage = false;
  @Input() currentUserId = '';
  @Input() currentUserName = '';

  documents: InvestigationDocument[] = [];
  isOpen = false;
  showArchived = false;
  searchTerm = '';
  highlightedDocumentId = '';
  editingDocument?: InvestigationDocument;
  editorOpen = false;
  editorTitle = '';
  editorDescription = '';
  editorFile?: File;
  editorFileName = '';
  editorError = '';
  saving = false;
  processingDocumentId = '';
  downloadingDocumentId = '';
  private subscription?: Subscription;

  constructor(private documentsService: InvestigationDocumentService) {}

  ngOnInit(): void {
    this.subscription = this.documentsService.documents$.subscribe({
      next: (documents) => {
        this.documents = documents;
      },
      error: () => {
        this.editorError = 'Impossible de charger les documents ajoutés.';
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get activeDocumentCount(): number {
    return this.documents.filter((document) => document.active).length;
  }

  get visibleDocuments(): InvestigationDocument[] {
    const term = this.searchTerm.trim().toLocaleLowerCase('fr');
    return this.documents.filter((document) => {
      if (!this.showArchived && !document.active) return false;
      if (!term) return true;
      return `${document.title} ${document.description || ''}`
        .toLocaleLowerCase('fr')
        .includes(term);
    });
  }

  open(preferredDocumentId = ''): void {
    this.isOpen = true;
    this.highlightedDocumentId = preferredDocumentId;
    this.searchTerm = '';
    this.editorError = '';
    if (preferredDocumentId) {
      setTimeout(() => {
        document
          .getElementById(`investigation-document-${preferredDocumentId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  close(): void {
    if (this.saving) return;
    this.isOpen = false;
    this.cancelEditor();
  }

  beginAdd(): void {
    if (!this.canManage) return;
    this.editingDocument = undefined;
    this.editorTitle = '';
    this.editorDescription = '';
    this.editorFile = undefined;
    this.editorFileName = '';
    this.editorError = '';
    this.editorOpen = true;
  }

  beginReplace(document: InvestigationDocument): void {
    if (!this.canManage) return;
    this.editingDocument = document;
    this.editorTitle = document.title;
    this.editorDescription = document.description || '';
    this.editorFile = undefined;
    this.editorFileName = '';
    this.editorError = '';
    this.editorOpen = true;
  }

  cancelEditor(): void {
    if (this.saving) return;
    this.editorOpen = false;
    this.editingDocument = undefined;
    this.editorFile = undefined;
    this.editorFileName = '';
    this.editorError = '';
  }

  onFileSelected(fileList: FileList | null): void {
    const file = fileList?.item(0) || undefined;
    this.editorFile = file;
    this.editorFileName = file?.name || '';
    this.editorError = investigationPdfValidationError(file);
  }

  async saveDocument(): Promise<void> {
    if (!this.canManage || this.saving) return;
    const file = this.editorFile;
    this.editorError = investigationPdfValidationError(file);
    if (!this.editorTitle.trim()) {
      this.editorError = 'Indiquez un titre pour le document.';
    }
    if (this.editorError || !file) return;

    this.saving = true;
    try {
      const identity: InvestigationDocumentEditorIdentity = {
        uid: this.currentUserId,
        name: this.currentUserName,
      };
      if (this.editingDocument) {
        await this.documentsService.replaceDocument(
          this.editingDocument,
          file,
          this.editorTitle,
          this.editorDescription,
          identity
        );
      } else {
        const nextSortOrder =
          Math.max(0, ...this.documents.map((document) => document.sortOrder)) + 10;
        await this.documentsService.addDocument(
          file,
          this.editorTitle,
          this.editorDescription,
          identity,
          nextSortOrder
        );
      }
      this.cancelEditorAfterSave();
    } catch (error) {
      this.editorError =
        error instanceof Error && error.message
          ? error.message
          : "Impossible d'enregistrer le document. Réessayez.";
    } finally {
      this.saving = false;
    }
  }

  async archive(document: InvestigationDocument): Promise<void> {
    if (!this.canManage || this.processingDocumentId) return;
    const confirmed = window.confirm(
      `Retirer « ${document.title} » de la bibliothèque ? Le document pourra être restauré.`
    );
    if (!confirmed) return;
    this.processingDocumentId = document.id;
    try {
      await this.documentsService.archiveDocument(document);
    } catch {
      this.editorError = 'Impossible de retirer le document. Réessayez.';
    } finally {
      this.processingDocumentId = '';
    }
  }

  async restore(document: InvestigationDocument): Promise<void> {
    if (!this.canManage || this.processingDocumentId) return;
    this.processingDocumentId = document.id;
    try {
      await this.documentsService.restoreDocument(document);
    } catch {
      this.editorError = 'Impossible de restaurer le document. Réessayez.';
    } finally {
      this.processingDocumentId = '';
    }
  }

  async download(document: InvestigationDocument): Promise<void> {
    const url = investigationDocumentUrl(document);
    if (!url || this.downloadingDocumentId) return;
    this.downloadingDocumentId = document.id;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('download-failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = document.fileName || `${document.title}.pdf`;
      anchor.rel = 'noopener';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl));
    } catch {
      window.open(url, '_blank', 'noopener');
    } finally {
      this.downloadingDocumentId = '';
    }
  }

  formatDate(value?: string): string {
    if (!value) return 'Modèle initial';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date non renseignée';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatSize(size?: number): string {
    if (!size) return 'PDF';
    return size >= 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  trackByDocumentId(_: number, document: InvestigationDocument): string {
    return document.id;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.editorOpen) {
      this.cancelEditor();
    } else if (this.isOpen) {
      this.close();
    }
  }

  private cancelEditorAfterSave(): void {
    this.editorOpen = false;
    this.editingDocument = undefined;
    this.editorFile = undefined;
    this.editorFileName = '';
    this.editorError = '';
  }
}
