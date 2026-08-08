import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Audit } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { QuestionsComponent } from './questions.component';

describe('QuestionsComponent', () => {
  let component: QuestionsComponent;
  let fixture: ComponentFixture<QuestionsComponent>;

  function appDate(value: Date): string {
    return `${value.getMonth() + 1}-${value.getDate()}-${value.getFullYear()}`;
  }

  function normalizedText(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [QuestionsComponent],
      imports: [FormsModule],
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: {
              email: 'audit@kank.test',
              firstName: 'Audit',
            },
            isAdmin: false,
            getAuditInfo: () => of([]),
            getAllUsersInfo: () => of([]),
            getClientsOfAUser: () => of([]),
          },
        },
        {
          provide: DataService,
          useValue: {
            removePendingClientFromAudit: jasmine
              .createSpy('removePendingClientFromAudit')
              .and.resolveTo(),
          },
        },
        {
          provide: AngularFirestore,
          useValue: {},
        },
        {
          provide: AngularFireStorage,
          useValue: {},
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate'),
          },
        },
        {
          provide: ComputationService,
          useValue: {
            rateDollar: 2900,
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(QuestionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders a simple priority-first page heading', () => {
    expect(normalizedText()).toContain('Clients à vérifier');
    expect(normalizedText()).toContain(
      'Les dossiers les plus urgents apparaissent en premier'
    );
  });

  it('shows the tier, requested date, and money date without extra warnings', () => {
    const requested = new Date(2026, 6, 23);
    const moneyDate = new Date(2026, 6, 24);
    component.audits = [
      Object.assign(new Audit(), {
        id: 'audit-1',
        name: 'Marie',
        phoneNumber: '0811111111',
        pendingClients: [
          {
            clientId: 'client-1',
            clientName: 'Jean Mukendi',
            clientLocation: 'Gombe',
            clientPhoneNumber: '0822222222',
            creditScore: '72',
            dateOfRequest: appDate(requested),
            requestDate: appDate(moneyDate),
          },
        ],
      }),
    ];

    fixture.detectChanges();

    expect(normalizedText()).toContain('🏆 Meilleur client');
    expect(normalizedText()).toContain('Date de demande');
    expect(normalizedText()).toContain('Remise');
    expect(normalizedText()).toContain('Jean Mukendi');
    expect(normalizedText()).not.toContain('frustration client');
  });

  it('puts the earliest audit deadline first and missing dates last', () => {
    const audit = Object.assign(new Audit(), {
      pendingClients: [
        { clientName: 'Date manquante' },
        { clientName: 'Plus tard', requestDate: '8-10-2026' },
        { clientName: 'Urgent', requestDate: '7-24-2026' },
      ],
    });

    const sorted = component.pendingClientsForAudit(audit);

    expect(sorted.map((client) => client.clientName)).toEqual([
      'Urgent',
      'Plus tard',
      'Date manquante',
    ]);
  });

  it('keeps unverified clients visible and excludes verified clients', () => {
    const audit = Object.assign(new Audit(), {
      pendingClients: [
        {
          clientId: 'unverified-client',
          clientName: 'Client en attente',
          __matchedClient: {
            uid: 'unverified-client',
            agentSubmittedVerification: '',
          },
        },
        {
          clientId: 'verified-client',
          clientName: 'Client vérifié',
          __matchedClient: {
            uid: 'verified-client',
            agentSubmittedVerification: 'true',
          },
        },
      ],
    });

    expect(
      component
        .pendingClientsForAudit(audit)
        .map((client) => client.clientName)
    ).toEqual(['Client en attente']);
    expect(component.pendingClientCount(audit)).toBe(1);
  });

  it('shows each requested amount and estimates the queue total in FC and USD', () => {
    component.audits = [
      Object.assign(new Audit(), {
        id: 'audit-1',
        name: 'Marie',
        pendingClients: [
          {
            clientId: 'client-1',
            clientName: 'Client Snapshot',
            requestAmount: '300,000',
          },
          {
            clientId: 'client-2',
            clientName: 'Client Matched',
            __matchedClient: {
              uid: 'client-2',
              requestAmount: '580000',
            },
          },
          {
            clientId: 'client-verified',
            clientName: 'Client Already Verified',
            requestAmount: '999000',
            __matchedClient: {
              uid: 'client-verified',
              agentSubmittedVerification: 'true',
            },
          },
        ],
      }),
    ];

    fixture.detectChanges();

    expect(component.pendingClientTotalCount()).toBe(2);
    expect(component.pendingClientKnownAmountCount()).toBe(2);
    expect(component.pendingClientTotalRequestedFc()).toBe(880000);
    expect(component.pendingClientTotalRequestedUsd()).toBe(304);
    expect(normalizedText()).toContain('300,000 FC');
    expect(normalizedText()).toContain('580,000 FC');
    expect(normalizedText()).toContain('880,000 FC');
    expect(normalizedText()).toContain('≈ $304');
    expect(normalizedText()).toContain('1 $ = 2,900 FC');
  });

  it('marks the estimate as partial when a requested amount is unavailable', () => {
    component.audits = [
      Object.assign(new Audit(), {
        pendingClients: [
          { clientName: 'Montant connu', requestAmount: '250000' },
          { clientName: 'Montant manquant' },
        ],
      }),
    ];

    fixture.detectChanges();

    expect(component.pendingClientMissingAmountCount()).toBe(1);
    expect(component.pendingClientTotalRequestedFc()).toBe(250000);
    expect(normalizedText()).toContain('Total partiel : 1 montant(s) introuvable(s)');
    expect(normalizedText()).toContain('Non trouvé');
  });
});
