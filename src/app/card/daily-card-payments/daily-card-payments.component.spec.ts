import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyCardPaymentsComponent } from './daily-card-payments.component';

describe('DailyCardPaymentsComponent', () => {
  let component: DailyCardPaymentsComponent;
  let fixture: ComponentFixture<DailyCardPaymentsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DailyCardPaymentsComponent]
    });
    fixture = TestBed.createComponent(DailyCardPaymentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
