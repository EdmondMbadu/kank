import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackingCardMonthComponent } from './tracking-card-month.component';

describe('TrackingCardMonthComponent', () => {
  let component: TrackingCardMonthComponent;
  let fixture: ComponentFixture<TrackingCardMonthComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TrackingCardMonthComponent]
    });
    fixture = TestBed.createComponent(TrackingCardMonthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
