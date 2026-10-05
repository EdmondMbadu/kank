import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, NgModel } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { TenDigitPhoneDirective } from './ten-digit-phone.directive';

@Component({
  template: '<input type="tel" appTenDigitPhone maxlength="10" required pattern="[0-9]{10}" [(ngModel)]="phone" [disabled]="disabled">',
})
class PhoneTestComponent {
  phone = '';
  disabled = false;
}

describe('TenDigitPhoneDirective', () => {
  let fixture: ComponentFixture<PhoneTestComponent>;
  let input: HTMLInputElement;

  function type(value: string, cursor = value.length): void {
    input.value = value;
    input.setSelectionRange(cursor, cursor);
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function paste(value: string): void {
    const clipboard = new DataTransfer();
    clipboard.setData('text', value);
    input.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: clipboard, cancelable: true,
    }));
    fixture.detectChanges();
  }

  function expectPhone(value: string): void {
    expect(input.value).toBe(value);
    expect(fixture.componentInstance.phone).toBe(value);
    expect(fixture.debugElement.query(By.css('input')).injector.get(NgModel).value).toBe(value);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PhoneTestComponent, TenDigitPhoneDirective],
      imports: [FormsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(PhoneTestComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    input = fixture.nativeElement.querySelector('input');
  });

  it('removes non-digits, preserves leading zero and caps input at ten digits', () => {
    type('ab081 234-56789');
    expectPhone('0812345678');
    expect(input.selectionStart).toBe(10);
  });

  it('keeps model and form validity synchronized when a letter is typed into a valid number', () => {
    type('0812345678');
    type('081234a5678', 7);
    expectPhone('0812345678');
    expect(input.selectionStart).toBe(6);
    expect(fixture.debugElement.query(By.css('input')).injector.get(NgModel).valid).toBeTrue();
  });

  it('cleans a formatted paste before imposing the ten-digit limit', () => {
    paste('081 234 5678');
    expectPhone('0812345678');
    paste('letters99');
    expectPhone('0812345678');
  });

  it('replaces selected digits when pasting into a full number', () => {
    type('0812345678');
    input.setSelectionRange(3, 6);
    paste('9x8y7z6');
    expectPhone('0819875678');
    expect(input.selectionStart).toBe(6);
  });

  it('allows deleting and replacing digits after reaching ten', () => {
    type('0812345678');
    type('081234567');
    expectPhone('081234567');
    type('0812345670');
    expectPhone('0812345670');
  });

  it('does not silently modify invalid stored numbers when rendering them', async () => {
    fixture.componentInstance.phone = '08123456789';
    fixture.detectChanges();
    await fixture.whenStable();
    expectPhone('08123456789');
    expect(fixture.debugElement.query(By.css('input')).injector.get(NgModel).valid).toBeFalse();
  });

  it('preserves disabled and touched form states', async () => {
    input.dispatchEvent(new Event('blur'));
    expect(fixture.debugElement.query(By.css('input')).injector.get(NgModel).touched).toBeTrue();
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.disabled).toBeTrue();
  });
});
