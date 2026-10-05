import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { FormsModule, NgModel } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { TenDigitPhoneDirective } from 'src/app/shared/directives/ten-digit-phone.directive';
import { NewCardComponent } from './new-card.component';

describe('NewCardComponent', () => {
  let component: NewCardComponent;
  let fixture: ComponentFixture<NewCardComponent>;
  let addCard: jasmine.Spy;
  let updateInfo: jasmine.Spy;
  let navigate: jasmine.Spy;
  let confirmSpy: jasmine.Spy;
  let alertSpy: jasmine.Spy;

  function phoneInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('#phone');
  }

  function setPhone(value: string): void {
    phoneInput().value = value;
    phoneInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function phoneMessage(): string {
    return fixture.nativeElement.querySelector('#phoneValidation').textContent.trim();
  }

  function fillRegistration(): void {
    component.firstName = 'Sarah';
    component.middleName = 'Mule';
    component.lastName = 'Kasongo';
    component.profession = 'Vendeuse';
    component.homeAddress = 'Kimayala 41';
    component.businessAddress = 'Matete';
    component.phoneNumber = '0812345678';
    component.amountToPay = '10000';
  }

  function submit(): void {
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    addCard = jasmine.createSpy('addNewClientCard').and.resolveTo();
    updateInfo = jasmine.createSpy('updateUserInfoForNewCardClient').and.resolveTo();
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    confirmSpy = spyOn(window, 'confirm').and.returnValue(true);
    alertSpy = spyOn(window, 'alert');

    await TestBed.configureTestingModule({
      declarations: [NewCardComponent, TenDigitPhoneDirective],
      imports: [FormsModule],
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: AuthService, useValue: {
          currentUser: { email: 'agent@kank.test', firstName: 'Agent' },
          addNewClientCard: addCard,
        } },
        { provide: DataService, useValue: {
          numbersValid: (value: string) => Number(value) > 0,
          updateUserInfoForNewCardClient: updateInfo,
        } },
        { provide: TimeService, useValue: { todaysDate: () => '10-4-2026' } },
        { provide: PerformanceService, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NewCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('marks the telephone required with a realistic example and accessible guidance', () => {
    expect(phoneInput().required).toBeTrue();
    expect(phoneInput().pattern).toBe('[0-9]{10}');
    expect(phoneInput().maxLength).toBe(10);
    expect(phoneInput().placeholder).toBe('Ex. : 0812345678');
    expect(phoneInput().inputMode).toBe('numeric');
    expect(phoneInput().getAttribute('aria-describedby')).toBe('phoneValidation');
    expect(phoneInput().getAttribute('aria-invalid')).toBe('false');
    expect(phoneMessage()).toBe('Obligatoire : exactement 10 chiffres.');
    expect(fixture.debugElement.query(By.css('#phone')).injector.get(NgModel).valid).toBeFalse();
  });

  it('shows a required error when the untouched empty field is blurred', () => {
    phoneInput().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(phoneMessage()).toContain('Le téléphone est obligatoire.');
    expect(phoneInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('continues rendering live validation while the current user is unavailable', () => {
    TestBed.inject(AuthService).currentUser = null;
    setPhone('081234567');
    expect(phoneMessage()).toBe('Il manque 1 chiffre. Entrez exactement 10 chiffres.');
    expect(phoneInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('blocks an empty submission and focuses the telephone field', () => {
    fillRegistration();
    component.phoneNumber = '';
    const focusSpy = spyOn(phoneInput(), 'focus');
    submit();
    expect(phoneMessage()).toContain('Le téléphone est obligatoire.');
    expect(focusSpy).toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(addCard).not.toHaveBeenCalled();
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('updates the missing digit count as the user types and clears the error at 10 digits', () => {
    setPhone('081');
    expect(phoneMessage()).toBe('Il manque 7 chiffres. Entrez exactement 10 chiffres.');
    setPhone('081234567');
    expect(phoneMessage()).toBe('Il manque 1 chiffre. Entrez exactement 10 chiffres.');
    expect(phoneInput().classList.contains('field-input-error')).toBeTrue();
    setPhone('0812345678');
    expect(component.isPhoneNumberValid).toBeTrue();
    expect(component.phoneNumber).toBe('0812345678');
    expect(phoneMessage()).toBe('Obligatoire : exactement 10 chiffres.');
    expect(phoneInput().getAttribute('aria-invalid')).toBe('false');
    expect(phoneInput().classList.contains('field-input-error')).toBeFalse();
    expect(fixture.debugElement.query(By.css('#phone')).injector.get(NgModel).valid).toBeTrue();
  });

  it('caps input at ten digits and removes letters from the input and model', () => {
    setPhone('08123456789');
    expect(phoneInput().value).toBe('0812345678');
    expect(component.phoneNumber).toBe('0812345678');
    setPhone('ab081 234-5678xy');
    expect(phoneInput().value).toBe('0812345678');
    expect(component.phoneNumber).toBe('0812345678');
    expect(fixture.debugElement.query(By.css('#phone')).injector.get(NgModel).value).toBe('0812345678');
    setPhone('abc');
    expect(phoneInput().value).toBe('');
    expect(component.phoneNumber).toBe('');
    expect(phoneMessage()).toContain('Le téléphone est obligatoire.');
  });

  it('shows the required error immediately when a previously entered number is cleared', () => {
    setPhone('0812345678');
    setPhone('');
    expect(phoneMessage()).toContain('Le téléphone est obligatoire.');
    expect(component.isPhoneNumberValid).toBeFalse();
  });

  [
    '081234567', '08123456789', '081234567a', '+818234567',
    '081 2345678', '081-2345678', ' 0812345678 ', '          ',
    '０８１２３４５６７８',
  ].forEach((value) => {
    it(`blocks registration for invalid telephone ${JSON.stringify(value)}`, () => {
      fillRegistration();
      component.phoneNumber = value;
      submit();
      expect(component.isPhoneNumberValid).toBeFalse();
      expect(phoneInput().getAttribute('aria-invalid')).toBe('true');
      expect(phoneMessage()).toContain('10 chiffres');
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(addCard).not.toHaveBeenCalled();
      expect(updateInfo).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it('preserves the required checks for the other registration fields', () => {
    fillRegistration();
    component.firstName = '';
    component.addNewCardClient();
    expect(alertSpy).toHaveBeenCalledWith('Completer tous les données');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(addCard).not.toHaveBeenCalled();
  });

  it('preserves the minimum payment validation', () => {
    fillRegistration();
    component.amountToPay = 'invalid';
    component.addNewCardClient();
    expect(alertSpy).toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(addCard).not.toHaveBeenCalled();
  });

  it('preserves cancellation at the existing confirmation', () => {
    fillRegistration();
    confirmSpy.and.returnValue(false);
    component.addNewCardClient();
    expect(confirmSpy).toHaveBeenCalled();
    expect(addCard).not.toHaveBeenCalled();
    expect(component.phoneNumber).toBe('0812345678');
  });

  it('saves the valid phone and existing payment before updating and navigating', fakeAsync(() => {
    fillRegistration();
    setPhone('0812345678');
    submit();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(addCard).toHaveBeenCalledTimes(1);
    expect(addCard.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      firstName: 'Sarah', middleName: 'Mule', lastName: 'Kasongo',
      phoneNumber: '0812345678', profession: 'Vendeuse',
      homeAddress: 'Kimayala 41', businessAddress: 'Matete',
      amountToPay: '10000', amountPaidToday: '10000',
      payments: { '10-4-2026': '10000' },
    }));
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    flushMicrotasks();
    expect(updateInfo).toHaveBeenCalledOnceWith(component.card);
    expect(navigate).toHaveBeenCalledOnceWith(['client-info-card/current']);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(component.phoneNumber).toBe('');
    expect(component.phoneInteracted).toBeFalse();
    expect(component.phoneValidationMessage).toBe('');
  }));

  it('keeps entered data and does not navigate if saving fails', fakeAsync(() => {
    fillRegistration();
    addCard.and.rejectWith(new Error('Save failed'));
    component.addNewCardClient();
    flushMicrotasks();
    expect(alertSpy).toHaveBeenCalled();
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.phoneNumber).toBe('0812345678');
    expect(component.firstName).toBe('Sarah');
  }));

  it('keeps entered data and does not navigate if updating user information fails', fakeAsync(() => {
    fillRegistration();
    updateInfo.and.rejectWith(new Error('Update failed'));
    component.addNewCardClient();
    flushMicrotasks();
    expect(addCard).toHaveBeenCalledTimes(1);
    expect(updateInfo).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.phoneNumber).toBe('0812345678');
  }));
});
