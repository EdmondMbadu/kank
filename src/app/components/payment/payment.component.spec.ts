import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { PaymentComponent } from './payment.component';

describe('PaymentComponent', () => {
  let component: PaymentComponent;
  let fixture: ComponentFixture<PaymentComponent>;

  let queryParams: Record<string, string>;
  let authService: {
    currentUser: Record<string, string>;
    isAdmninistrator: boolean;
    getAllClients: jasmine.Spy;
  };
  let dataService: {
    clientDeposit: jasmine.Spy;
  };

  const paymentClient = Object.assign(new Client(), {
    uid: 'client-0',
    firstName: 'Rebecca',
    lastName: 'Kanku',
    phoneNumber: '0893258653',
    debtLeft: '20000',
    amountToPay: '40000',
    amountPaid: '20000',
    creditScore: '70',
    paymentPeriodRange: '4',
    debtCycleStartDate: '3-1-2026',
    payments: {},
    savings: '10000',
  });

  function textContent(): string {
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
    queryParams = {};

    authService = {
      currentUser: {
        email: 'agent@kank.test',
        firstName: 'Agent',
        savingsRequiredPercent: '30',
      },
      isAdmninistrator: false,
      getAllClients: jasmine
        .createSpy('getAllClients')
        .and.returnValue(of([Object.assign(new Client(), paymentClient)])),
    };

    dataService = {
      clientDeposit: jasmine.createSpy('clientDeposit').and.returnValue(Promise.resolve()),
    };

    await TestBed.configureTestingModule({
      declarations: [PaymentComponent],
      imports: [FormsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            snapshot: {
              paramMap: convertToParamMap({ id: '0' }),
              queryParamMap: convertToParamMap(queryParams),
            },
          }),
        },
        { provide: AuthService, useValue: authService },
        { provide: DataService, useValue: dataService },
        {
          provide: TimeService,
          useValue: {
            todaysDateMonthDayYear: () => '3-20-2026',
            todaysDate: () => '3-20-2026-10-00-00',
            weeksSince: () => 0,
            getDateInFiveWeeksPlus: () => '4-24-2026',
            getDateInNineWeeksPlus: () => '5-22-2026',
            isGivenDateLessOrEqual: () => true,
            weeksElapsed: () => 0,
          },
        },
        {
          provide: ComputationService,
          useValue: {
            minimumPayment: () => '5000',
            getMaxLendAmount: () => 350000,
          },
        },
        {
          provide: PerformanceService,
          useValue: {
            updateUserPerformance: jasmine.createSpy('updateUserPerformance'),
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
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(PaymentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('renders the payment form with the route client and manual mode by default', () => {
    createComponent();

    expect(textContent()).toContain('Paiement par Rebecca Kanku');
    expect(textContent()).toContain('Détails du paiement');
    expect(component.paymentMethod).toBe('manual');
    expect(fixture.nativeElement.querySelector('#mobileMoneyPhone')).toBeNull();

    const paymentMethod = query<HTMLSelectElement>('#paymentMethod');
    const methodLabels = Array.from(paymentMethod.options).map((option) =>
      option.textContent?.trim()
    );

    expect(methodLabels).toContain('Paiement manuel');
    expect(methodLabels).toContain('Payer par Mobile Money');
  });

  it('keeps the savings "Autre montant" flow visible and reversible', () => {
    createComponent();

    const savingsSelect = query<HTMLSelectElement>('#savings');
    const savingsOptions = Array.from(savingsSelect.options).map((option) =>
      option.textContent?.trim()
    );

    expect(savingsOptions).toContain('Autre montant');
    expect(fixture.nativeElement.querySelector('#savingsOther')).toBeNull();

    selectOption('#savings', 'Autre montant');
    expect(component.savingsOtherAmount).toBeTrue();
    expect(query<HTMLInputElement>('#savingsOther').placeholder).toContain('20,000');

    selectOption('#savings', 'FC 0');
    expect(component.savingsOtherAmount).toBeFalse();
    expect(fixture.nativeElement.querySelector('#savingsOther')).toBeNull();
  });

  it('keeps the payment "Autre montant" flow visible and reversible', () => {
    createComponent();

    const paymentSelect = query<HTMLSelectElement>('#payment');
    const paymentOptions = Array.from(paymentSelect.options).map((option) =>
      option.textContent?.trim()
    );

    expect(paymentOptions).toContain('Autre montant');
    expect(fixture.nativeElement.querySelector('#paymentOther')).toBeNull();

    selectOption('#payment', 'Autre montant');
    expect(component.paymentOtherAmount).toBeTrue();
    expect(query<HTMLInputElement>('#paymentOther').placeholder).toContain('20,000');

    selectOption('#payment', 'FC 5000');
    expect(component.paymentOtherAmount).toBeFalse();
    expect(fixture.nativeElement.querySelector('#paymentOther')).toBeNull();
  });

  it('starts in mobile mode from the query string and pre-fills the client phone', () => {
    queryParams = { method: 'mobile' };

    createComponent();
    fixture.detectChanges();

    expect(component.paymentMethod).toBe('mobile');
    expect(component.mobileMoneyPhone).toBe('0893258653');
    expect(textContent()).toContain('Téléphone Mobile Money');

    expect(query<HTMLInputElement>('#mobileMoneyPhone')).toBeTruthy();
  });

  it('shows the submitting state in the UI when a payment is in progress', () => {
    createComponent();

    component.isSubmitting = true;
    fixture.detectChanges();

    const submitButton = query<HTMLButtonElement>('button.payment-primary-button');
    expect(submitButton.disabled).toBeTrue();
    expect(textContent()).toContain('Traitement');
    expect(textContent()).toContain("Enregistrement de l'opération");
    expect(textContent()).toContain('Veuillez patienter, ne fermez pas la page.');
  });

  it('allows high savings during a normal debt payment without applying the debt-cleared cap', () => {
    createComponent();

    component.paymentAmount = '5000';
    component.savingsAmount = '200000';

    const makePaymentSpy = spyOn<any>(component, 'makePayment');
    component.submitPayment();

    expect(makePaymentSpy).toHaveBeenCalled();
  });

  it('blocks savings-only deposits above the cap after the debt is cleared', () => {
    createComponent();

    component.client.debtLeft = '0';
    component.client.amountPaid = component.client.amountToPay;
    component.paymentAmount = '0';
    component.savingsAmount = '96000';

    const alertSpy = spyOn(window, 'alert');
    component.submitPayment();

    expect(alertSpy).toHaveBeenCalled();
    expect(alertSpy.calls.mostRecent().args[0]).toContain(
      "Le total d'épargne ne peut pas dépasser 30%"
    );
    expect(dataService.clientDeposit).not.toHaveBeenCalled();
  });

  it('records a manual savings-only deposit within the cap after the debt is cleared', fakeAsync(() => {
    createComponent();

    component.client.debtLeft = '0';
    component.client.amountPaid = component.client.amountToPay;
    component.paymentAmount = '0';
    component.savingsAmount = '90000';

    spyOn(window, 'confirm').and.returnValue(true);
    const navigateSpy = TestBed.inject(Router).navigate as jasmine.Spy;

    component.submitPayment();
    tick();

    expect(dataService.clientDeposit).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/client-portal', '0']);
  }));
});
