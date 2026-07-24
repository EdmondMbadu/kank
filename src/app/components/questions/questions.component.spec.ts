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
            updateAuditPendingClients: jasmine
              .createSpy('updateAuditPendingClients')
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
    expect(normalizedText()).toContain('Demandé');
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
});
