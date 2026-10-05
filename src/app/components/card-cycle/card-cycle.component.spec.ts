import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { TenDigitPhoneDirective } from 'src/app/shared/directives/ten-digit-phone.directive';
import { CardCycleComponent } from './card-cycle.component';

describe('CardCycleComponent', () => {
  let component: CardCycleComponent;
  let fixture: ComponentFixture<CardCycleComponent>;
  let startCycle: jasmine.Spy;
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

  it('preserves cancellation without changing the card cycle', () => {
    confirmSpy.and.returnValue(false);
    component.addNewCardClient();
    expect(confirmSpy).toHaveBeenCalled();
    expect(startCycle).not.toHaveBeenCalled();
    expect(component.clientCard.cardCycle).toBe('2');
  });

  it('renews with the corrected phone and existing payment sequence', fakeAsync(() => {
    setPhone('0893258653');
    submit();
    expect(startCycle).toHaveBeenCalledOnceWith(component.clientCard);
    expect(component.clientCard).toEqual(jasmine.objectContaining({
      uid: 'card-1', phoneNumber: '0893258653', cardCycle: '3',
      amountToPay: '10000', amountPaidToday: '10000',
      payments: { '10-4-2026': '10000' },
    }));
    expect(updateInfo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    flushMicrotasks();
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
});
