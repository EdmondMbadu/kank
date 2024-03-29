import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackingMonthCentralComponent } from './tracking-month-central.component';

describe('TrackingMonthCentralComponent', () => {
  let component: TrackingMonthCentralComponent;
  let fixture: ComponentFixture<TrackingMonthCentralComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TrackingMonthCentralComponent]
    });
    fixture = TestBed.createComponent(TrackingMonthCentralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
