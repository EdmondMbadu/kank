import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyLendingsComponent } from './daily-lendings.component';

describe('DailyLendingsComponent', () => {
  let component: DailyLendingsComponent;
  let fixture: ComponentFixture<DailyLendingsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DailyLendingsComponent]
    });
    fixture = TestBed.createComponent(DailyLendingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
