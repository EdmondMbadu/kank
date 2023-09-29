import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyPaymentsComponent } from './daily-payments.component';

describe('DailyPaymentsComponent', () => {
  let component: DailyPaymentsComponent;
  let fixture: ComponentFixture<DailyPaymentsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DailyPaymentsComponent]
    });
    fixture = TestBed.createComponent(DailyPaymentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
