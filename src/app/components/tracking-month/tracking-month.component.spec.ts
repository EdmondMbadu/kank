import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackingMonthComponent } from './tracking-month.component';

describe('TrackingMonthComponent', () => {
  let component: TrackingMonthComponent;
  let fixture: ComponentFixture<TrackingMonthComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TrackingMonthComponent]
    });
    fixture = TestBed.createComponent(TrackingMonthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
