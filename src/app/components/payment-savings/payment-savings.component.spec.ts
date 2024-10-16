import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentSavingsComponent } from './payment-savings.component';

describe('PaymentSavingsComponent', () => {
  let component: PaymentSavingsComponent;
  let fixture: ComponentFixture<PaymentSavingsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PaymentSavingsComponent]
    });
    fixture = TestBed.createComponent(PaymentSavingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
