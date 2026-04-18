import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { NewCycleRegisterComponent } from './new-cycle-register.component';

describe('NewCycleRegisterComponent', () => {
  let component: NewCycleRegisterComponent;
  let fixture: ComponentFixture<NewCycleRegisterComponent>;

  const cycleClient = Object.assign(new Client(), {
    uid: 'client-28',
    firstName: 'Rebecca',
    lastName: 'Kanku',
    middleName: 'Mbuyi',
    phoneNumber: '0893258653',
    profession: 'Vendeuse',
    businessCapital: '50000',
    homeAddress: 'Kimayala',
    businessAddress: 'Marché',
    creditScore: '72',
    savings: '20000',
    profilePicture: { downloadURL: 'https://example.com/photo.jpg' },
    payments: {},
  });

  const employee = Object.assign(new Employee(), {
    uid: 'employee-1',
    firstName: 'Jean',
    middleName: 'Paul',
    lastName: 'Mbuyi',
  });

  function normalizedText(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }

  function query<T extends Element>(selector: string): T {
    const element = fixture.nativeElement.querySelector(selector) as T | null;
    expect(element).withContext(`Missing element for selector: ${selector}`).not.toBeNull();
    return element as T;
  }

  function setInput(selector: string, value: string): void {
    const input = query<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
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

  function populateValidSubmissionFields(loanAmount: string): void {
    component.maxNumberOfDaysToLend = 31;
    component.client.firstName = 'Rebecca';
    component.middleName = 'Mbuyi';
    component.client.lastName = 'Kanku';
    component.client.phoneNumber = '0893258653';
    component.client.profession = 'Vendeuse';
    component.client.businessCapital = '50000';
    component.client.homeAddress = 'Kimayala';
    component.client.businessAddress = 'Marche';
    component.client.birthDate = '1990-05-10';
    component.age = 35;
    component.client.profilePicture = { downloadURL: 'https://example.com/photo.jpg' };
    component.applicationFee = '5000';
    component.memberShipFee = '0';
    component.client.creditScore = '72';
    component.client.savings = '20000';
    component.savings = '15000';
    component.loanAmount = loanAmount;
    component.requestDate = '2026-03-25';
    component.references = ['Maman Jeanne - 0812345678'];
    component.codeVerificationStatus = 'correct';
    component.maxLoanAmount = 350000;
  }

  beforeEach(async () => {
    const clients = Array.from({ length: 29 }, () => new Client());
    clients[28] = Object.assign(new Client(), cycleClient);

    await TestBed.configureTestingModule({
      declarations: [NewCycleRegisterComponent],
      imports: [FormsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '28' }),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: {
              email: 'agent@kank.test',
              firstName: 'Agent',
              maxNumberOfClients: '80',
              maxNumberOfDaysToLend: '20',
              monthBudget: '1000000',
              monthBudgetPending: '0',
              savingsRequiredPercent: '30',
            },
            getAllClients: jasmine.createSpy('getAllClients').and.returnValue(of(clients)),
            getAllEmployees: jasmine
              .createSpy('getAllEmployees')
              .and.returnValue(of([employee])),
          },
        },
        {
          provide: DataService,
          useValue: {
            generalMaxNumberOfClients: 70,
            generalMaxNumberOfDaysToLend: 20,
            numbersValid: jasmine
              .createSpy('numbersValid')
              .and.callFake((...values: string[]) =>
                values.every((value) => !isNaN(Number(value)) && Number(value) >= 0)
              ),
            findClientsWithDebts: jasmine
              .createSpy('findClientsWithDebts')
              .and.returnValue([cycleClient]),
          },
        },
        {
          provide: TimeService,
          useValue: {
            validateDateWithInOneWeekNotPastOrToday: () => true,
          },
        },
        {
          provide: PerformanceService,
          useValue: {},
        },
        {
          provide: ComputationService,
          useValue: {
            getMaxLendAmount: (score: number) => (score <= 0 ? 0 : 350000),
          },
        },
        {
          provide: AngularFireFunctions,
          useValue: {
            httpsCallable: jasmine.createSpy('httpsCallable'),
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

    fixture = TestBed.createComponent(NewCycleRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the route client, fixed fees, verification block, and loan limit', () => {
    expect(normalizedText()).toContain('Nouveau cycle pour Rebecca Kanku');
    expect(normalizedText()).toContain('Informations du client');
    expect(normalizedText()).toContain('Références');
    expect(normalizedText()).toContain('Paramètres du cycle');
    expect(normalizedText()).toContain('Vérification');
    expect(normalizedText()).toContain('350,000 FC');

    const disabledFeeInputs = Array.from(
      fixture.nativeElement.querySelectorAll('input.cycle-input-disabled')
    ) as HTMLInputElement[];

    expect(disabledFeeInputs.length).toBe(2);
    expect(disabledFeeInputs[0].value.replace(/\s+/g, '')).toBe('FC5000');
    expect(disabledFeeInputs[1].value.replace(/\s+/g, '')).toBe('FC0');
  });

  it('switches the birth date area to the saved static value when a birth date exists', () => {
    component.client.birthDate = '1990-05-10';
    component.updateAge();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#birthDate')).toBeNull();
    expect(normalizedText()).toContain('1990-05-10');
    expect(normalizedText()).toContain('Âge :');
  });

  it('shows and hides the custom savings field from the UI selection', () => {
    expect(fixture.nativeElement.querySelector('#savingsOther')).toBeNull();

    selectOption('#savings', 'Autre montant');

    expect(component.savingsOtherDisplay).toBeTrue();
    expect(query<HTMLInputElement>('#savingsOther').placeholder).toContain('20,000');

    selectOption('#savings', 'FC 0');

    expect(component.savingsOtherDisplay).toBeFalse();
    expect(fixture.nativeElement.querySelector('#savingsOther')).toBeNull();
  });

  it('shows and hides the custom loan amount field from the UI selection', () => {
    expect(fixture.nativeElement.querySelector('#loanAmount')).toBeNull();

    selectOption('#countries', 'Autre montant');

    expect(component.loanAmountOtherDisplay).toBeTrue();
    expect(query<HTMLInputElement>('#loanAmount').placeholder).toContain('20,000');
    expect(normalizedText()).toContain('Le montant à prêter doit être de 50 000 FC ou plus.');

    selectOption('#countries', 'FC 100,000');

    expect(component.loanAmountOtherDisplay).toBeFalse();
    expect(fixture.nativeElement.querySelector('#loanAmount')).toBeNull();
  });

  it('shows the next eligible credit date when score is zero and the six-month wait is still active', () => {
    const lastPayment = new Date();
    lastPayment.setMonth(lastPayment.getMonth() - 2);

    component.client.creditScore = '0';
    component.client.payments = {
      [`${lastPayment.getMonth() + 1}-${lastPayment.getDate()}-${lastPayment.getFullYear()}-10-00-00`]:
        '10000',
    };

    component.retrieveClient();
    fixture.detectChanges();

    expect(component.shouldShowCreditEligibilityDate).toBeTrue();
    expect(normalizedText()).toContain('Ce client peut demander un nouveau crédit à partir du');
    expect(normalizedText()).toContain(component.nextEligibleCreditDateLabel);
    expect(normalizedText()).toContain(component.lastPaymentDateLabel);
    expect(normalizedText()).toContain('accessible à partir du');
  });

  it('keeps only the minimum savings rule on a new cycle and allows higher savings', () => {
    component.loanAmount = '100000';
    component.savings = '40000';
    fixture.detectChanges();

    expect(component.minimumSavingsRequiredForRequestedLoan).toBe(30000);
    expect(component.savingsPaidAtleast30PercentOfLoanAmount()).toBeTrue();
    expect(normalizedText()).toContain(
      "Au-delà de ce minimum, un montant plus élevé est autorisé."
    );
  });

  it('keeps the references action disabled until the inputs are valid, then renders the added reference', () => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    const addButton = buttons.find((button) =>
      button.textContent?.includes('Ajouter la référence')
    );

    expect(addButton).toBeDefined();
    expect(addButton!.disabled).toBeTrue();

    setInput('#newReferenceName', 'Maman Jeanne');
    setInput('#newReferencePhone', '123');

    expect(normalizedText()).toContain('Entrez exactement 10 chiffres.');
    expect(addButton!.disabled).toBeTrue();

    setInput('#newReferencePhone', '0812345678');

    expect(addButton!.disabled).toBeFalse();

    component.addReference();
    fixture.detectChanges();

    expect(component.references).toEqual(['Maman Jeanne - 0812345678']);
    expect(normalizedText()).toContain('Maman Jeanne - 0812345678');
    expect(normalizedText()).toContain('1/3');
  });

  it('blocks submission when the requested loan amount is less than 50 000 FC', () => {
    populateValidSubmissionFields('40 000');
    const alertSpy = spyOn(window, 'alert');
    const proceedSpy = spyOn(component, 'proceed');

    component.registerClientNewDebtCycle();

    expect(proceedSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    expect(String(alertSpy.calls.mostRecent().args[0])).toContain(
      'Le montant à prêter doit être supérieur ou égal à'
    );
    expect(String(alertSpy.calls.mostRecent().args[0])).toContain('50');
  });

  it('allows submission when the requested loan amount is exactly 50 000 FC', () => {
    populateValidSubmissionFields('50 000');
    const alertSpy = spyOn(window, 'alert');
    const proceedSpy = spyOn(component, 'proceed');

    component.registerClientNewDebtCycle();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(proceedSpy).toHaveBeenCalled();
    expect(component.loanAmount).toBe('50000');
  });
});
