import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackingCardMonthCentralComponent } from './tracking-card-month-central.component';

describe('TrackingCardMonthCentralComponent', () => {
  let component: TrackingCardMonthCentralComponent;
  let fixture: ComponentFixture<TrackingCardMonthCentralComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TrackingCardMonthCentralComponent]
    });
    fixture = TestBed.createComponent(TrackingCardMonthCentralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
