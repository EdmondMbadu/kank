import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RotationScheduleComponent } from './rotation-schedule.component';

describe('RotationScheduleComponent', () => {
  let component: RotationScheduleComponent;
  let fixture: ComponentFixture<RotationScheduleComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RotationScheduleComponent]
    });
    fixture = TestBed.createComponent(RotationScheduleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
