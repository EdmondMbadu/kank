import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TodayCentralComponent } from './today-central.component';

describe('TodayCentralComponent', () => {
  let component: TodayCentralComponent;
  let fixture: ComponentFixture<TodayCentralComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TodayCentralComponent]
    });
    fixture = TestBed.createComponent(TodayCentralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
