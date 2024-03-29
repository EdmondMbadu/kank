import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackingCentralComponent } from './tracking-central.component';

describe('TrackingCentralComponent', () => {
  let component: TrackingCentralComponent;
  let fixture: ComponentFixture<TrackingCentralComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TrackingCentralComponent]
    });
    fixture = TestBed.createComponent(TrackingCentralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
