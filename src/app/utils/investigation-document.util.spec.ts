import {
  BUILTIN_INVESTIGATION_DOCUMENTS,
  cleanInvestigationDocumentFileName,
  investigationDocumentUrl,
  investigationPdfValidationError,
  mergeInvestigationDocuments,
} from './investigation-document.util';

describe('investigation document utilities', () => {
  it('provides the two built-in templates in a stable order', () => {
    const documents = mergeInvestigationDocuments([]);

    expect(documents.map((document) => document.id)).toEqual([
      'mise-en-demeure',
      'attestation-prise-en-charge-paiement',
    ]);
    expect(documents.every((document) => document.active)).toBeTrue();
  });

  it('overlays stored metadata without losing the built-in asset fallback', () => {
    const [builtin] = BUILTIN_INVESTIGATION_DOCUMENTS;
    const [document] = mergeInvestigationDocuments([
      {
        ...builtin,
        active: false,
        title: 'Titre administrateur',
      },
    ]);

    expect(document.active).toBeFalse();
    expect(document.title).toBe('Titre administrateur');
    expect(investigationDocumentUrl(document)).toBe(builtin.assetUrl || '');
  });

  it('prefers an uploaded download URL over a bundled asset', () => {
    expect(
      investigationDocumentUrl({
        ...BUILTIN_INVESTIGATION_DOCUMENTS[0],
        downloadURL: 'https://example.test/new.pdf',
      })
    ).toBe('https://example.test/new.pdf');
  });

  it('validates PDF type, content, and size', () => {
    expect(
      investigationPdfValidationError({
        name: 'document.pdf',
        type: 'application/pdf',
        size: 1024,
      })
    ).toBe('');
    expect(
      investigationPdfValidationError({
        name: 'image.jpg',
        type: 'image/jpeg',
        size: 1024,
      })
    ).toContain('PDF');
    expect(
      investigationPdfValidationError({
        name: 'document.pdf',
        type: 'application/pdf',
        size: 21 * 1024 * 1024,
      })
    ).toContain('20 MB');
  });

  it('cleans unsafe file names and preserves the PDF extension', () => {
    expect(cleanInvestigationDocumentFileName(' Attestation Été 2026.PDF ')).toBe(
      'attestation-t-2026.pdf'
    );
  });
});
