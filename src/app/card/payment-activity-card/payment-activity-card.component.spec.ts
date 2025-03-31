import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentActivityCardComponent } from './payment-activity-card.component';

describe('PaymentActivityCardComponent', () => {
  let component: PaymentActivityCardComponent;
  let fixture: ComponentFixture<PaymentActivityCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PaymentActivityCardComponent]
    });
    fixture = TestBed.createComponent(PaymentActivityCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
