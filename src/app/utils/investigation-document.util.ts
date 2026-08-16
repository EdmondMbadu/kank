import { InvestigationDocument } from '../models/investigation-document';

export const INVESTIGATION_DOCUMENT_MAX_FILE_SIZE = 20 * 1024 * 1024;

export const BUILTIN_INVESTIGATION_DOCUMENTS: InvestigationDocument[] = [
  {
    id: 'mise-en-demeure',
    title: 'Mise en demeure',
    description: 'Modèle officiel à compléter avant remise au client.',
    fileName: 'mise-en-demeure.pdf',
    mimeType: 'application/pdf',
    sortOrder: 10,
    active: true,
    source: 'builtin',
    version: 1,
    assetUrl: 'assets/documents/mise-en-demeure.pdf',
  },
  {
    id: 'attestation-prise-en-charge-paiement',
    title: 'Attestation de prise en charge du paiement',
    description:
      'Modèle vierge à faire signer par le client, la personne désignée et la Fondation.',
    fileName: 'attestation-prise-en-charge-paiement.pdf',
    mimeType: 'application/pdf',
    sortOrder: 20,
    active: true,
    source: 'builtin',
    version: 1,
    assetUrl: 'assets/documents/attestation-prise-en-charge-paiement.pdf',
  },
];

export function mergeInvestigationDocuments(
  stored: InvestigationDocument[] | null | undefined
): InvestigationDocument[] {
  const documents = new Map<string, InvestigationDocument>();

  BUILTIN_INVESTIGATION_DOCUMENTS.forEach((document) => {
    documents.set(document.id, { ...document });
  });

  (stored || []).forEach((document) => {
    const builtin = documents.get(document.id);
    documents.set(document.id, {
      ...(builtin || {}),
      ...document,
      id: document.id,
      mimeType: 'application/pdf',
      active: document.active !== false,
      source: document.source || (builtin ? 'builtin' : 'uploaded'),
      version: Math.max(1, Number(document.version) || 1),
      sortOrder: Number.isFinite(Number(document.sortOrder))
        ? Number(document.sortOrder)
        : builtin?.sortOrder || 999,
    } as InvestigationDocument);
  });

  return Array.from(documents.values()).sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.title.localeCompare(right.title, 'fr')
  );
}

export function investigationDocumentUrl(
  document?: InvestigationDocument | null
): string {
  return document?.downloadURL || document?.assetUrl || '';
}

export function cleanInvestigationDocumentFileName(fileName: string): string {
  const cleaned = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.endsWith('.pdf') ? cleaned : `${cleaned || 'document'}.pdf`;
}

export function investigationPdfValidationError(file?: {
  name?: string;
  type?: string;
  size?: number;
}): string {
  if (!file) return 'Sélectionnez un fichier PDF.';
  const isPdf =
    file.type === 'application/pdf' ||
    (file.name || '').toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'Seuls les fichiers PDF sont acceptés.';
  if ((file.size || 0) <= 0) return 'Le fichier sélectionné est vide.';
  if ((file.size || 0) > INVESTIGATION_DOCUMENT_MAX_FILE_SIZE) {
    return 'Le fichier dépasse la limite de 20 MB.';
  }
  return '';
}
