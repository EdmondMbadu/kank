import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { RegisterClientComponent } from './register-client.component';

describe('RegisterClientComponent', () => {
  let component: RegisterClientComponent;
  let fixture: ComponentFixture<RegisterClientComponent>;

  const existingClient = Object.assign(new Client(), {
    uid: 'client-existing',
    firstName: 'Aline',
    lastName: 'Mbuyi',
    middleName: 'Kanku',
    debtLeft: '10000',
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegisterClientComponent],
      imports: [FormsModule],
      providers: [
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
            },
            getAllClients: jasmine
              .createSpy('getAllClients')
              .and.returnValue(of([existingClient])),
          },
        },
        {
          provide: DataService,
          useValue: {
            generalMaxNumberOfClients: 70,
            generalMaxNumberOfDaysToLend: 20,
            findClientsWithDebts: jasmine
              .createSpy('findClientsWithDebts')
              .and.returnValue([existingClient]),
          },
        },
        {
          provide: TimeService,
          useValue: {
            todaysDateMonthDayYear: () => '3-20-2026',
            todaysDate: () => '3-20-2026-10-00-00',
            validateDateWithInOneWeekNotPastOrToday: () => true,
            convertDateToMonthDayYear: (value: string) => value,
          },
        },
        {
          provide: PerformanceService,
          useValue: {},
        },
        {
          provide: AngularFireFunctions,
          useValue: {
            httpsCallable: jasmine.createSpy('httpsCallable'),
          },
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

    fixture = TestBed.createComponent(RegisterClientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the registration page with its critical sections and fixed fee fields', () => {
    expect(normalizedText()).toContain('Enregistrer client');
    expect(normalizedText()).toContain('Profil du client');
    expect(normalizedText()).toContain('Activité et situation');
    expect(normalizedText()).toContain('Références');
    expect(normalizedText()).toContain('Conditions financières');
    expect(normalizedText()).toContain('Vérification');
    expect(normalizedText()).toContain('Soumettre');

    const disabledFeeInputs = Array.from(
      fixture.nativeElement.querySelectorAll('input.register-input-disabled')
    ) as HTMLInputElement[];

    expect(disabledFeeInputs.length).toBe(2);
    expect(disabledFeeInputs[0].disabled).toBeTrue();
    expect(disabledFeeInputs[0].value.replace(/\s+/g, '')).toBe('FC5000');
    expect(disabledFeeInputs[1].disabled).toBeTrue();
    expect(disabledFeeInputs[1].value.replace(/\s+/g, '')).toBe('FC10000');
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
    expect(fixture.nativeElement.querySelector('#loanAmountOther')).toBeNull();

    selectOption('#loanAmount', 'Autre montant');

    expect(component.loanAmountOtherDisplay).toBeTrue();
    expect(query<HTMLInputElement>('#loanAmountOther').placeholder).toContain('20,000');

    selectOption('#loanAmount', 'FC 100,000');

    expect(component.loanAmountOtherDisplay).toBeFalse();
    expect(fixture.nativeElement.querySelector('#loanAmountOther')).toBeNull();
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

    setInput('#newReferenceName', 'Marie Kanku');
    setInput('#newReferencePhone', '123');

    expect(normalizedText()).toContain('Entrez exactement 10 chiffres.');
    expect(addButton!.disabled).toBeTrue();

    setInput('#newReferencePhone', '0893258653');

    expect(addButton!.disabled).toBeFalse();

    component.addReference();
    fixture.detectChanges();

    expect(component.references).toEqual(['Marie Kanku - 0893258653']);
    expect(normalizedText()).toContain('Marie Kanku - 0893258653');
    expect(normalizedText()).toContain('1/3');
  });
});
