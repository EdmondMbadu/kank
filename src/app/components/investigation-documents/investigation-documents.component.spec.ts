import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { InvestigationDocumentService } from 'src/app/services/investigation-document.service';
import { mergeInvestigationDocuments } from 'src/app/utils/investigation-document.util';
import { InvestigationDocumentsComponent } from './investigation-documents.component';

describe('InvestigationDocumentsComponent', () => {
  let component: InvestigationDocumentsComponent;
  let fixture: ComponentFixture<InvestigationDocumentsComponent>;
  let service: jasmine.SpyObj<InvestigationDocumentService>;

  beforeEach(async () => {
    service = jasmine.createSpyObj<InvestigationDocumentService>(
      'InvestigationDocumentService',
      ['addDocument', 'replaceDocument', 'archiveDocument', 'restoreDocument'],
      { documents$: of(mergeInvestigationDocuments([])) }
    );
    service.archiveDocument.and.resolveTo();
    service.restoreDocument.and.resolveTo();

    await TestBed.configureTestingModule({
      declarations: [InvestigationDocumentsComponent],
      imports: [FormsModule],
      providers: [{ provide: InvestigationDocumentService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(InvestigationDocumentsComponent);
    component = fixture.componentInstance;
    component.open();
    fixture.detectChanges();
  });

  it('shows both built-in PDFs and verifier download actions', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Mise en demeure');
    expect(text).toContain('Attestation de prise en charge du paiement');
    expect(text).toContain('Télécharger');
    expect(text).not.toContain('Ajouter un PDF');
    expect(text).not.toContain('Remplacer');
  });

  it('shows management actions only for an administrator', () => {
    component.canManage = true;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ajouter un PDF');
    expect(text).toContain('Remplacer');
    expect(text).toContain('Retirer');
  });

  it('archives only after confirmation', async () => {
    component.canManage = true;
    spyOn(window, 'confirm').and.returnValue(true);

    await component.archive(component.documents[0]);

    expect(service.archiveDocument).toHaveBeenCalledOnceWith(component.documents[0]);
  });

  it('can focus the contextual blank payment-responsibility template', () => {
    component.open('attestation-prise-en-charge-paiement');

    expect(component.highlightedDocumentId).toBe(
      'attestation-prise-en-charge-paiement'
    );
  });
});
