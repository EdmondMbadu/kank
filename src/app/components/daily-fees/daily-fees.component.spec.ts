import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyFeesComponent } from './daily-fees.component';

describe('DailyFeesComponent', () => {
  let component: DailyFeesComponent;
  let fixture: ComponentFixture<DailyFeesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DailyFeesComponent]
    });
    fixture = TestBed.createComponent(DailyFeesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
