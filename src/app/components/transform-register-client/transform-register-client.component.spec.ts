import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TransformRegisterClientComponent } from './transform-register-client.component';

describe('TransformRegisterClientComponent', () => {
  let component: TransformRegisterClientComponent;
  let fixture: ComponentFixture<TransformRegisterClientComponent>;

  let authService: {
    isAdmin: boolean;
    currentUser: Record<string, string>;
    getAllClients: jasmine.Spy;
    getAllEmployees: jasmine.Spy;
  };

  const transformClient = Object.assign(new Client(), {
    uid: 'client-71',
    firstName: 'Noella',
    middleName: 'Mbala',
    lastName: 'Kanku',
    phoneNumber: '0893258653',
    profession: 'Commerçante',
    businessCapital: '70000',
    homeAddress: 'Masina',
    businessAddress: 'Marché Gambela',
    creditScore: '80',
    debtCycle: '1',
    agentSubmittedVerification: 'true',
    profilePicture: { downloadURL: 'https://example.com/photo.jpg' },
  });

  const employees = [
    Object.assign(new Employee(), {
      uid: 'employee-1',
      firstName: 'Jean',
      middleName: 'Paul',
      lastName: 'Mbuyi',
    }),
    Object.assign(new Employee(), {
      uid: 'employee-2',
      firstName: 'Sarah',
      middleName: 'K.',
      lastName: 'Mutombo',
    }),
  ];

  function normalizedText(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }

  function query<T extends Element>(selector: string): T {
    const element = fixture.nativeElement.querySelector(selector) as T | null;
    expect(element).withContext(`Missing element for selector: ${selector}`).not.toBeNull();
    return element as T;
  }

  function selectOption(selector: string, optionLabel: string): void {
    const select = query<HTMLSelectElement>(selector);
    const option = Array.from(select.options).find((item) =>
      item.textContent?.toLowerCase().includes(optionLabel.toLowerCase())
    );

    expect(option)
      .withContext(`Missing option "${optionLabel}" in ${selector}`)
      .toBeDefined();

    select.value = option!.value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    const clients = Array.from({ length: 72 }, () => new Client());
    clients[71] = transformClient;

    authService = {
      isAdmin: false,
      currentUser: {
        email: 'agent@kank.test',
        firstName: 'Agent',
        monthBudget: '1000000',
      },
      getAllClients: jasmine.createSpy('getAllClients').and.returnValue(of(clients)),
      getAllEmployees: jasmine.createSpy('getAllEmployees').and.returnValue(of(employees)),
    };

    await TestBed.configureTestingModule({
      declarations: [TransformRegisterClientComponent],
      imports: [FormsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '71' }),
            },
          },
        },
        { provide: AuthService, useValue: authService },
        {
          provide: DataService,
          useValue: {
            generalMaxNumberOfClients: 70,
            findClientsWithDebts: jasmine
              .createSpy('findClientsWithDebts')
              .and.returnValue([transformClient]),
            computeAmountToPay: jasmine
              .createSpy('computeAmountToPay')
              .and.returnValue('240000'),
          },
        },
        {
          provide: TimeService,
          useValue: {
            computeDateRange: () => ['3-20-2026', ''],
            getDateInFiveWeeks: () => '4-24-2026',
            getDateInNineWeeks: () => '5-22-2026',
          },
        },
        { provide: PerformanceService, useValue: {} },
        {
          provide: ComputationService,
          useValue: {
            getMaxLendAmount: () => 600000,
          },
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
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(TransformRegisterClientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('renders the page with client data, employee choices, and the key cycle sections', () => {
    createComponent();

    expect(normalizedText()).toContain('Transformer en client complet');
    expect(normalizedText()).toContain('Informations du client');
    expect(normalizedText()).toContain('Paramètres du cycle');
    expect(normalizedText()).toContain('600,000 FC');

    const agentSelect = query<HTMLSelectElement>('#agent');
    const agentOptions = Array.from(agentSelect.options).map((option) =>
      option.textContent?.trim()
    );

    expect(agentOptions).toContain('Jean Paul Mbuyi');
    expect(agentOptions).toContain('Sarah K. Mutombo');
  });

  it('renders the custom loan field when the component enters the "Autre montant" state', () => {
    authService.isAdmin = true;
    createComponent();

    expect(fixture.nativeElement.querySelector('#loanAmountOther')).toBeNull();

    component.loanAmount = 'Autre Montant';
    component.displayLoanOtherAmount();
    fixture.detectChanges();

    expect(component.loanAmountOtherDisplay).toBeTrue();
    expect(query<HTMLInputElement>('#loanAmountOther').placeholder).toContain('20,000');
  });

  it('shows the computed rate, amount to pay, and cycle period after selecting a loan and pay range', () => {
    authService.isAdmin = true;
    createComponent();

    const loanAmountSelect = query<HTMLSelectElement>('#loanAmount');
    expect(loanAmountSelect.disabled).toBeFalse();

    component.loanAmount = '200000';
    component.payRange = '4';
    component.displayRate();
    fixture.detectChanges();

    expect(component.rateDisplay).toBeTrue();
    expect(component.interestRate).toBe('20');
    expect(component.amountToPay).toBe('240000');
    expect(component.debtCycleStartDate).toBe('3-20-2026');
    expect(component.debtCycleEndDate).toBe('4-24-2026');
    expect(query<HTMLInputElement>('#rate')).toBeTruthy();
    expect(query<HTMLInputElement>('#amountToPay')).toBeTruthy();
    expect(query<HTMLInputElement>('#debtCycle')).toBeTruthy();
  });

  it('shows the confirmation modal when the component enters confirmation mode', () => {
    createComponent();

    component.showConfirmation = true;
    fixture.detectChanges();

    expect(normalizedText()).toContain("Confirmation d'enregistrement");
    expect(normalizedText()).toContain('Je confirme avoir respecté toutes les règles ci-dessus.');
    expect(query<HTMLInputElement>('#confirmCheck').checked).toBeFalse();
  });
});
