import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { assertCardPhoneIdentity, CardPhoneValidationError } from 'src/app/utils/card-phone-identity.util';
import { TenDigitPhoneDirective } from 'src/app/shared/directives/ten-digit-phone.directive';
import { CardCycleComponent } from './card-cycle.component';

describe('CardCycleComponent', () => {
  let component: CardCycleComponent;
  let fixture: ComponentFixture<CardCycleComponent>;
  let startCycle: jasmine.Spy;
  let validatePhone: jasmine.Spy;
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

  function submit(): void {
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    startCycle = jasmine.createSpy('startNewCardCycle').and.resolveTo();
    validatePhone = jasmine.createSpy('validateClientCardPhone').and.resolveTo();
    updateInfo = jasmine.createSpy('updateUserInfoForNewCardCycleClient').and.resolveTo();
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    confirmSpy = spyOn(window, 'confirm').and.returnValue(true);
    alertSpy = spyOn(window, 'alert');
    const card = Object.assign(new Card(), {
      uid: 'card-1', firstName: 'Sarah', middleName: 'Mule', lastName: 'Kasongo',
      phoneNumber: '0812345678', profession: 'Vendeuse',
      homeAddress: 'Kimayala 41', businessAddress: 'Matete', cardCycle: '2',
    });
    await TestBed.configureTestingModule({
      declarations: [CardCycleComponent, TenDigitPhoneDirective],
      imports: [FormsModule],
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } },
        { provide: AuthService, useValue: {
          currentUser: { email: 'agent@kank.test', firstName: 'Agent' },
          getAllClientsCard: () => of([new Card(), card]),
          startNewCardCycle: startCycle,
          validateClientCardPhone: validatePhone,
        } },
        { provide: DataService, useValue: {
          numbersValid: (value: string) => Number(value) > 0,
          updateUserInfoForNewCardCycleClient: updateInfo,
        } },
        { provide: TimeService, useValue: { todaysDate: () => '10-4-2026' } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(CardCycleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    component.amountToPay = '10000';
  });

  it('loads the selected card and renders the required ten-digit field', () => {
    expect(component.clientCard.uid).toBe('card-1');
    expect(phoneInput().value).toBe('0812345678');
    expect(phoneInput().required).toBeTrue();
    expect(phoneInput().maxLength).toBe(10);
    expect(phoneInput().pattern).toBe('[0-9]{10}');
    expect(phoneInput().placeholder).toBe('Ex. : 0812345678');
  });

  it('filters letters and excess digits in both the field and the renewal model', () => {
    setPhone('abc08123456789');
    expect(phoneInput().value).toBe('0812345678');
    expect(component.clientCard.phoneNumber).toBe('0812345678');
    expect(component.isPhoneNumberValid).toBeTrue();
  });

  it('shows missing digits live and clears the error after correcting the number', () => {
    setPhone('081234567');
    expect(phoneMessage()).toBe('Il manque 1 chiffre. Entrez exactement 10 chiffres.');
    expect(phoneInput().getAttribute('aria-invalid')).toBe('true');
    setPhone('0812345678');
    expect(phoneInput().getAttribute('aria-invalid')).toBe('false');
    expect(phoneInput().classList.contains('card-cycle-input-error')).toBeFalse();
  });

  it('requires an empty phone and returns focus to it on submission', () => {
    setPhone('');
    const focusSpy = spyOn(phoneInput(), 'focus');
    submit();
    expect(phoneMessage()).toContain('Le téléphone est obligatoire.');
    expect(focusSpy).toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(startCycle).not.toHaveBeenCalled();
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.clientCard.cardCycle).toBe('2');
  });

  [undefined, '', '081234567', '08123456789', '081234567a', '0812345678\n'].forEach((value) => {
    it(`blocks renewal for invalid stored phone ${JSON.stringify(value)}`, () => {
      component.clientCard.phoneNumber = value;
      submit();
      expect(component.isPhoneNumberValid).toBeFalse();
      expect(phoneMessage()).toContain('10 chiffres');
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(startCycle).not.toHaveBeenCalled();
      expect(updateInfo).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(component.clientCard.cardCycle).toBe('2');
    });
  });

  it('preserves the other required fields and amount checks', () => {
    component.clientCard.firstName = '';
    component.addNewCardClient();
    expect(alertSpy).toHaveBeenCalledWith('Completer tous les données');
    component.clientCard.firstName = 'Sarah';
    component.amountToPay = 'invalid';
    component.addNewCardClient();
    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(startCycle).not.toHaveBeenCalled();
  });

  it('preserves cancellation without changing the card cycle', fakeAsync(() => {
    confirmSpy.and.returnValue(false);
    component.addNewCardClient();
    expect(confirmSpy).not.toHaveBeenCalled();
    flushMicrotasks();
    expect(confirmSpy).toHaveBeenCalled();
    expect(startCycle).not.toHaveBeenCalled();
    expect(component.clientCard.cardCycle).toBe('2');
    expect(component.isSubmitting).toBeFalse();
  }));

  it('renews with the corrected phone and existing payment sequence', fakeAsync(() => {
    let finishSave!: () => void;
    startCycle.and.returnValue(new Promise<void>((resolve) => { finishSave = resolve; }));
    setPhone('0893258653');
    submit();
    expect(validatePhone).toHaveBeenCalledWith(jasmine.objectContaining({ uid: 'card-1', phoneNumber: '0893258653' }), 'card-1');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(startCycle).not.toHaveBeenCalled();
    flushMicrotasks();
    expect(startCycle).toHaveBeenCalledTimes(1);
    expect(startCycle.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      uid: 'card-1', phoneNumber: '0893258653', cardCycle: '3',
      amountToPay: '10000', amountPaidToday: '10000',
      payments: { '10-4-2026': '10000' },
    }));
    expect(component.clientCard.cardCycle).toBe('2');
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    finishSave();
    flushMicrotasks();
    expect(component.clientCard.cardCycle).toBe('3');
    expect(updateInfo).toHaveBeenCalledOnceWith(component.clientCard);
    expect(navigate).toHaveBeenCalledOnceWith(['/client-portal-card/1']);
    expect(alertSpy).not.toHaveBeenCalled();
  }));

  it('does not update or navigate if starting the cycle fails', fakeAsync(() => {
    startCycle.and.rejectWith(new Error('Save failed'));
    component.addNewCardClient();
    flushMicrotasks();
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    expect(component.clientCard.phoneNumber).toBe('0812345678');
    expect(component.clientCard.cardCycle).toBe('2');
  }));

  it('does not navigate if updating user information fails', fakeAsync(() => {
    updateInfo.and.rejectWith(new Error('Update failed'));
    component.addNewCardClient();
    flushMicrotasks();
    expect(startCycle).toHaveBeenCalled();
    expect(updateInfo).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
  }));


  it('shows a concise employee-phone rejection inline and preserves the entered data', fakeAsync(() => {

    validatePhone.and.rejectWith(new CardPhoneValidationError('employee-phone',
      'Ce numéro appartient à un employé. Entrez le numéro du client.'));
    const focusSpy = spyOn(phoneInput(), 'focus');
    submit();
    expect(component.isSubmitting).toBeTrue();
    expect(fixture.nativeElement.querySelector('button').disabled).toBeTrue();
    expect(phoneInput().readOnly).toBeTrue();
    flushMicrotasks();
    fixture.detectChanges();
    expect(phoneMessage()).toBe('Ce numéro appartient à un employé. Entrez le numéro du client.');
    expect(phoneInput().getAttribute('aria-invalid')).toBe('true');
    expect(focusSpy).toHaveBeenCalled();
    expect(component.clientCard.phoneNumber).toBe('0812345678');
    expect(component.isSubmitting).toBeFalse();
    expect(fixture.nativeElement.querySelector('button').disabled).toBeFalse();
    expect(phoneInput().readOnly).toBeFalse();
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  }));

  it('clears the rejection after changing the phone and allows a successful retry', fakeAsync(() => {

    validatePhone.and.rejectWith(new CardPhoneValidationError('employee-phone', 'Entrez le numéro du client.'));
    submit();
    flushMicrotasks();
    fixture.detectChanges();
    setPhone('0893258653');
    expect(component.phoneIdentityError).toBe('');
    expect(phoneInput().getAttribute('aria-invalid')).toBe('false');
    validatePhone.and.resolveTo();
    submit();
    flushMicrotasks();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(component.clientCard.cardCycle).toBe('3');
  }));

  it('clears a name-conflict message after correcting a name', fakeAsync(() => {

    validatePhone.and.rejectWith(new CardPhoneValidationError('name-conflict', 'Aucun nom ne correspond.'));
    submit();
    flushMicrotasks();
    fixture.detectChanges();
    const name: HTMLInputElement = fixture.nativeElement.querySelector('#first_name');
    name.value = 'Mbadu';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.phoneIdentityError).toBe('');
    expect(component.clientCard.lastName).toBe('Mbadu');
  }));

  it('prevents duplicate submissions while verification and saving are pending', fakeAsync(() => {

    component.addNewCardClient();
    component.addNewCardClient();
    expect(validatePhone).toHaveBeenCalledTimes(1);
    expect(startCycle).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    flushMicrotasks();
    expect(startCycle).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(updateInfo).toHaveBeenCalledTimes(1);
    expect(component.isSubmitting).toBeFalse();
  }));


  it('rejects the reported duplicate number before showing the confirmation', fakeAsync(() => {

    component.clientCard.phoneNumber = '2342342342';
    validatePhone.and.callFake(async (identity: any) => assertCardPhoneIdentity(identity, [{
      firstName: 'Edmond', middleName: 'Mbadu', lastName: 'Ngoma', phoneNumber: '2342342342',
    }], []));
    submit();
    expect(validatePhone).toHaveBeenCalledWith(jasmine.objectContaining({
      phoneNumber: '2342342342', firstName: 'Sarah', middleName: 'Mule', lastName: 'Kasongo',
    }), 'card-1');
    expect(confirmSpy).not.toHaveBeenCalled();
    flushMicrotasks();
    fixture.detectChanges();
    expect(phoneMessage()).toContain('Ce numéro est déjà utilisé par Edmond Mbadu Ngoma.');
    expect(phoneMessage()).toContain('Aucun nom ne correspond.');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(startCycle).not.toHaveBeenCalled();
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.isSubmitting).toBeFalse();
  }));

  it('allows a reused phone with a single matching name before confirmation', fakeAsync(() => {

    component.clientCard.lastName = 'Mbadu 2';
    validatePhone.and.callFake(async (identity: any) => assertCardPhoneIdentity(identity, [{
      firstName: 'Edmond', middleName: 'Mbadu', lastName: 'Ngoma', phoneNumber: '0812345678',
    }], []));
    submit();
    expect(confirmSpy).not.toHaveBeenCalled();
    flushMicrotasks();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(startCycle).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  }));

  it('shows connection retry guidance before confirmation when the lookup fails', fakeAsync(() => {

    validatePhone.and.rejectWith(new CardPhoneValidationError('lookup-failed',
      'Impossible de vérifier ce numéro. Vérifiez votre connexion et réessayez.'));
    submit();
    flushMicrotasks();
    fixture.detectChanges();
    expect(phoneMessage()).toBe('Impossible de vérifier ce numéro. Vérifiez votre connexion et réessayez.');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(startCycle).not.toHaveBeenCalled();
    expect(component.clientCard.phoneNumber).toBe('0812345678');
    expect(fixture.nativeElement.querySelector('button').disabled).toBeFalse();
  }));

  it('still displays a final-save rejection if the number becomes conflicting after confirmation', fakeAsync(() => {

    startCycle.and.rejectWith(new CardPhoneValidationError('name-conflict', 'Aucun nom ne correspond.'));
    submit();
    flushMicrotasks();
    fixture.detectChanges();
    expect(validatePhone).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(startCycle).toHaveBeenCalledTimes(1);
    expect(phoneMessage()).toBe('Aucun nom ne correspond.');
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.clientCard.phoneNumber).toBe('0812345678');
    expect(component.isSubmitting).toBeFalse();
  }));

  it('does not open a late confirmation if the employee leaves during the check', fakeAsync(() => {

    let finishCheck!: () => void;
    validatePhone.and.returnValue(new Promise<void>((resolve) => { finishCheck = resolve; }));
    submit();
    fixture.destroy();
    finishCheck();
    flushMicrotasks();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(startCycle).not.toHaveBeenCalled();
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  }));
});
