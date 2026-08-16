export type InvestigationDocumentSource = 'builtin' | 'uploaded';

export interface InvestigationDocumentVersion {
  version: number;
  fileName: string;
  assetUrl?: string;
  downloadURL?: string;
  storagePath?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  uploadedByName?: string;
}

export interface InvestigationDocument {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  mimeType: 'application/pdf';
  size?: number;
  sortOrder: number;
  active: boolean;
  source: InvestigationDocumentSource;
  version: number;
  assetUrl?: string;
  downloadURL?: string;
  storagePath?: string;
  uploadedAt?: string;
  updatedAt?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  versions?: InvestigationDocumentVersion[];
}
