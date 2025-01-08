import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentCycleActivityComponent } from './payment-cycle-activity.component';

describe('PaymentCycleActivityComponent', () => {
  let component: PaymentCycleActivityComponent;
  let fixture: ComponentFixture<PaymentCycleActivityComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PaymentCycleActivityComponent]
    });
    fixture = TestBed.createComponent(PaymentCycleActivityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
